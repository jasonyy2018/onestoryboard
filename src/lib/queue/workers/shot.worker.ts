import { Worker, Job } from "bullmq";
import { z } from "zod";
import { createBullConnection } from "@/lib/queue/connection";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateVideo, pollSeedanceTask } from "@/lib/ai/video";
import { generateImage, type ImageModelKey } from "@/lib/ai/image";
import { fetchAsBuffer, persistAsset } from "@/lib/ai/storage";
import { wrapCinematicPrompt, filterSensitiveWords } from "@/lib/orchestrator/safety";
import {
  resolveStoryboardImageModelKey,
} from "@/lib/orchestrator/project-image-model";
import {
  storyboardKeyframeAspectRatio,
  storyboardKeyframeNegative,
  storyboardKeyframeUserPrompt,
} from "@/lib/orchestrator/storyboard-keyframe";
import { wrapSeedancePart2Template } from "@/lib/prompts/seedance-row-prompt";

/** Seedance reference image cap (sheet first, then MRI anchors). */
const SEEDANCE_MAX_REFERENCE_IMAGES = 9;

const PayloadSchema = z.object({ shotId: z.string(), projectId: z.string() });

function dedupeUrls(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * Part 1 参考图选取（腾讯 OG 上限 3 张）：
 * - 只选该镜头实际出镜的角色（来自 charactersInShot 关联），最多 2 张
 * - 场景参考图 1 张
 * - 若角色不足 2 张，用道具图补充剩余槽位（优先选 imagePrompt 里提到名字的道具）
 */
function keyframeRefUrls(shot: {
  imagePrompt?: string | null;
  scene: { refImageUrl: string | null; props: { name: string; refImageUrl: string | null }[] };
  characters: { character: { refImageUrl: string | null } }[];
}): string[] {
  const urls: string[] = [];

  // 1. 出镜角色（最多 2 张）
  for (const sc of shot.characters) {
    if (sc.character.refImageUrl && urls.length < 2) urls.push(sc.character.refImageUrl);
  }

  // 2. 场景参考图（1 张）
  if (shot.scene.refImageUrl && urls.length < 3) urls.push(shot.scene.refImageUrl);

  // 3. 道具：优先选 imagePrompt 里提到名字的，填满剩余槽位
  if (urls.length < 3 && shot.scene.props.length > 0) {
    const promptText = (shot.imagePrompt ?? "").toLowerCase();
    // 先按情节相关性排序：在 prompt 里出现名字的道具优先
    const sorted = [...shot.scene.props].sort((a, b) => {
      const aMatch = promptText.includes(a.name.toLowerCase()) ? 0 : 1;
      const bMatch = promptText.includes(b.name.toLowerCase()) ? 0 : 1;
      return aMatch - bMatch;
    });
    for (const p of sorted) {
      if (p.refImageUrl && urls.length < 3) urls.push(p.refImageUrl);
    }
  }

  return dedupeUrls(urls);
}

/**
 * Helper: Poll a task until it succeeds or fails.
 */
async function pollTask<T>(args: {
  taskId: string;
  pollFn: (id: string) => Promise<{ url?: string; urls?: string[]; status: string }>;
  job: Job;
  stage: string;
  maxRetries?: number;
  intervalMs?: number;
}): Promise<string> {
  const { taskId, pollFn, job, stage, maxRetries = 180, intervalMs = 5000 } = args;

  for (let i = 0; i < maxRetries; i++) {
    await job.log(`Polling ${stage} task ${taskId} (attempt ${i + 1})...`);

    const res = await pollFn(taskId);

    if (res.status === "success" || res.status === "succeeded") {
      const finalUrl = res.url || (res.urls && res.urls[0]);
      if (!finalUrl) throw new Error(`${stage} task succeeded but returned no URL`);
      return finalUrl;
    }

    if (res.status === "failed" || res.status === "error") {
      throw new Error(`${stage} task ${taskId} failed on provider side`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`${stage} task ${taskId} timed out after ${maxRetries} attempts`);
}

export const shotWorker = new Worker(
  "shot",
  async (job) => {
    const { shotId, projectId } = PayloadSchema.parse(job.data);
    const log = logger.child({ shotId, projectId, jobId: job.id });
    log.info("[shot-worker] ▶ start");

    const shot = await db.shot.findUniqueOrThrow({
      where: { id: shotId },
      include: {
        characters: { include: { character: true } },
        scene: { include: { project: true, props: true } },
      },
    });

    if (shot.status === "READY" && shot.videoUrl) {
      log.info("[shot-worker] ✓ already READY, skipping");
      return { videoUrl: shot.videoUrl };
    }

    log.info(
      { currentStatus: shot.status, hasImage: !!shot.imageUrl, hasVideo: !!shot.videoUrl },
      "[shot-worker] shot state",
    );

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (project?.status === "PAUSED" || project?.status === "CANCELLED") {
      throw new Error(
        `Shot aborted: project is ${project.status}. Failing job so compose flow does not treat this shot as done.`,
      );
    }

    const config = (project?.modelConfig as Record<string, unknown>) || {};
    const imageModelKey: ImageModelKey = resolveStoryboardImageModelKey(config);

    // ─── 1) Part 1: imagePrompt + 角色/场景/道具资产参考图 → OG 生成故事板图 ───
    // 资产（角色/场景/道具）在此阶段作为参考图输入，锁定人物外貌、环境、道具一致性。
    // 生成的故事板图将作为 Part 2 Seedance 的唯一参考图。
    let storyboardKeyUrl = shot.imageUrl;

    if (!storyboardKeyUrl) {
      const imagePromptRaw = (shot.imagePrompt || shot.prompt || "").trim();
      if (!imagePromptRaw) {
        throw new Error("Shot has no imagePrompt/prompt; cannot build storyboard keyframe.");
      }

      await db.shot.update({
        where: { id: shotId },
        data: { status: "GENERATING_IMAGE" },
      });
      await job.updateProgress({ stage: "keyframe-start", percent: 5 });
      log.info({ model: imageModelKey }, "[shot-worker] ⬜ Part1 keyframe generating...");
      await job.log(`[shot-worker] keyframe model=${imageModelKey} layout=multi_panel_sheet`);

      const lang = shot.scene.project.language;
      const isZh = lang === "zh";
      const keyPrompt = filterSensitiveWords(
        storyboardKeyframeUserPrompt(imagePromptRaw, isZh ? "zh" : "en"),
      );
      const negative = storyboardKeyframeNegative(isZh ? "zh" : "en", imagePromptRaw);
      const aspect = storyboardKeyframeAspectRatio(config.aspectRatio as string | undefined);
      const refForKeyframe = keyframeRefUrls(shot);

      const imgRes = await generateImage(
        {
          prompt: keyPrompt,
          negativePrompt: negative,
          refImageUrls: refForKeyframe.length > 0 ? refForKeyframe : undefined,
          aspectRatio: aspect,
          size: "2K",
          n: 1,
        },
        imageModelKey,
      );

      if (!imgRes.url) throw new Error("Storyboard keyframe generation returned no URL");

      const imgBuf = await fetchAsBuffer(imgRes.url);
      const persistedKey = await persistAsset({
        key: `projects/${projectId}/shots/${shotId}-keyframe.jpg`,
        data: imgBuf,
        contentType: "image/jpeg",
      });

      storyboardKeyUrl = persistedKey;

      await db.shot.update({
        where: { id: shotId },
        data: {
          imageUrl: persistedKey,
          status: "IMAGE_READY",
          cost: { increment: imgRes.cost },
        },
      });
      await db.project.update({
        where: { id: projectId },
        data: { totalCost: { increment: imgRes.cost } },
      });

      await job.updateProgress({ stage: "keyframe-done", percent: 35 });
      log.info({ cost: imgRes.cost, url: persistedKey }, "[shot-worker] ✓ Part1 keyframe done");
    } else {
      log.info("[shot-worker] ✓ Part1 keyframe already exists, skipping image generation");
    }

    // ─── 2) Video (~15s): videoPrompt + Part2 template + 故事板图作为唯一参考图 ───
    // Part 1 已将角色/场景/道具锚点融入故事板图；Part 2 只需故事板图 + videoPrompt，
    // 不再重复传入 MRI 资产，避免 Seedance 受原始素材干扰构图一致性。
    await db.shot.update({
      where: { id: shotId },
      data: { status: "GENERATING_VIDEO" },
    });
    await job.updateProgress({ stage: "video-start", percent: 40 });

    // Part 2 参考图：使用角色已审核通过的 Volcengine asset:// ID。
    // asset:// 通道走报白资产库，不触发人脸审核（PrivacyInformation）。
    // 故事板图（含真实人脸）无论 URL 还是 base64 都会被拦截，暂不传入。
    // TODO: 待 Volcengine 开通故事板图 r2v 报白后，可将故事板图也 CreateAsset 入库后用 asset:// 传入。
    const refImageUrls: string[] = [];
    const volcengineAssetIds: string[] = [];

    // 收集该镜头出镜角色中已审核通过（Active）的 asset ID，最多取 2 个
    // 注意：若 asset 在火山引擎侧不存在（CreateAsset 曾超时），会报 InvalidParameter not found
    // 此时视频生成不传参考图，降级为纯文字驱动
    for (const sc of shot.characters) {
      const c = sc.character;
      if (
        c.volcengineAssetId &&
        c.volcengineStatus === "Active" &&
        volcengineAssetIds.length < 2
      ) {
        volcengineAssetIds.push(c.volcengineAssetId);
      }
    }

    if (volcengineAssetIds.length === 0) {
      log.warn("[shot-worker] no Active volcengine asset IDs for this shot — generating without reference image");
    } else {
      log.info({ assetIds: volcengineAssetIds }, "[shot-worker] Part2 reference: volcengine asset IDs");
    }

    const nConfig = (shot.scene.project.modelConfig as Record<string, unknown>) || {};
    const narrativeStyle = (nConfig.narrativeStyle as string) || "THIRD_PERSON";
    const lang = shot.scene.project.language;
    const isZh = lang === "zh";

    const motionFromTable =
      (shot.videoPrompt && shot.videoPrompt.trim()) || shot.prompt || shot.imagePrompt;

    const charactersPrompt = shot.characters
      .map((c) => `${c.character.name}: ${c.character.description}`)
      .join(isZh ? "；" : "; ");

    const loc = shot.scene.location;
    const timeOfDay = shot.scene.timeOfDay ? ` · ${shot.scene.timeOfDay}` : "";

    const narrativeLabel = isZh ? "# 旁白风格：" : "# Narration style:";
    const narrativeValue = narrativeStyle === "FIRST_PERSON"
      ? isZh ? "第一人称主观视角，解说型旁白，观众即主角。" : "First-person POV, explanatory voice-over, viewer is the protagonist."
      : isZh ? "第三人称电影叙事。" : "Third-person cinematic narration.";

    const rowScriptCore = isZh
      ? `# 场景：${loc}${timeOfDay}\n${narrativeLabel}\n${narrativeValue}\n\n# 角色：\n${charactersPrompt}\n\n# 镜头运动：${shot.cameraMove || "平滑推拉，浅景深"}\n\n# 视频脚本（严格按节拍顺序执行）：\n${motionFromTable}`
      : `# Scene: ${loc}${timeOfDay}\n${narrativeLabel}\n${narrativeValue}\n\n# Cast:\n${charactersPrompt}\n\n# Camera: ${shot.cameraMove || "smooth push-pull, shallow DOF"}\n\n# Video script (execute in strict beat order):\n${motionFromTable}`;

    const templated = wrapSeedancePart2Template(rowScriptCore, lang);
    const richPrompt = wrapCinematicPrompt(templated, lang);

    const refForVideo = dedupeUrls(refImageUrls).slice(0, SEEDANCE_MAX_REFERENCE_IMAGES);
    log.info(
      { model: "seedance-2.0-fast", refImages: refForVideo.length, duration: shot.duration },
      "[shot-worker] ⬜ Part2 video generating...",
    );
    const videoRes = await generateVideo(
      {
        prompt: richPrompt,
        duration: shot.duration,
        cameraMove: shot.cameraMove ?? undefined,
        ratio: (config.aspectRatio as string) || "9:16",
        refImageUrls: refForVideo.length > 0 ? refForVideo : undefined,
        volcengineAssetIds: volcengineAssetIds.length > 0 ? volcengineAssetIds : undefined,
        locale: shot.scene.project.language,
        generateAudio: true,
      },
    );

    let videoUrl = videoRes.url;

    if (videoRes.taskId && !videoUrl) {
      log.info({ taskId: videoRes.taskId }, "[shot-worker] polling Seedance task...");
      videoUrl = await pollTask({
        taskId: videoRes.taskId,
        pollFn: pollSeedanceTask,
        job,
        stage: "video",
      });
    }

    log.info({ videoUrl }, "[shot-worker] ✓ Part2 video done, persisting...");
    const vidBuf = await fetchAsBuffer(videoUrl);
    const persistedVid = await persistAsset({
      key: `projects/${projectId}/shots/${shotId}.mp4`,
      data: vidBuf,
      contentType: "video/mp4",
    });

    await db.shot.update({
      where: { id: shotId },
      data: {
        status: "READY",
        videoUrl: persistedVid,
        cost: { increment: videoRes.cost },
      },
    });
    await db.project.update({
      where: { id: projectId },
      data: { totalCost: { increment: videoRes.cost } },
    });

    await job.updateProgress({ stage: "done", percent: 100 });
    log.info({ cost: videoRes.cost, videoUrl: persistedVid }, "[shot-worker] ✓ done");
    return { videoUrl: persistedVid };
  },
  {
    connection: createBullConnection(),
    concurrency: env.WORKER_SHOT_CONCURRENCY,
    // OG 生图 + Seedance 视频各需要几分钟，必须延长持锁时间
    lockDuration: 20 * 60 * 1000,  // 20 分钟
    stalledInterval: 60 * 1000,
    maxStalledCount: 1,
  },
);

shotWorker.on("failed", async (job, err) => {
  logger.error({ jobId: job?.id, err }, "[shot-worker] failed");
  if (job?.data && typeof job.data === "object" && "shotId" in job.data) {
    const shotId = String((job.data as { shotId: string }).shotId);
    await db.shot.update({
      where: { id: shotId },
      data: {
        status: "FAILED",
        retryCount: { increment: 1 },
        errorMsg: err instanceof Error ? err.message : String(err),
      },
    });
  }
});
