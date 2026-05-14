import { Worker, Job } from "bullmq";
import { z } from "zod";
import { createBullConnection } from "@/lib/queue/connection";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateVideo, pollSeedanceTask, type VideoModelKey } from "@/lib/ai/video";
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
  const { taskId, pollFn, job, stage, maxRetries = 60, intervalMs = 5000 } = args;

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
    log.info("[shot-worker] start");

    const shot = await db.shot.findUniqueOrThrow({
      where: { id: shotId },
      include: {
        characters: { include: { character: true } },
        scene: { include: { project: true, props: true } },
      },
    });

    if (shot.status === "READY" && shot.videoUrl) {
      log.info("[shot-worker] shot already ready, skipping");
      return { videoUrl: shot.videoUrl };
    }

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
      log.info({ cost: imgRes.cost }, "[shot-worker] keyframe persisted");
    }

    // ─── 2) Video (~15s): videoPrompt + Part2 template + 故事板图作为唯一参考图 ───
    // Part 1 已将角色/场景/道具锚点融入故事板图；Part 2 只需故事板图 + videoPrompt，
    // 不再重复传入 MRI 资产，避免 Seedance 受原始素材干扰构图一致性。
    await db.shot.update({
      where: { id: shotId },
      data: { status: "GENERATING_VIDEO" },
    });
    await job.updateProgress({ stage: "video-start", percent: 40 });

    // Part 2 参考图：仅故事板图（首张且唯一）
    const refImageUrls: string[] = [];
    if (storyboardKeyUrl) refImageUrls.push(storyboardKeyUrl);

    // Volcengine 资产 ID 在 Part 2 不传入（已由 Part 1 生图阶段消费）
    const volcengineAssetIds: string[] = [];

    const nConfig = (shot.scene.project.modelConfig as Record<string, unknown>) || {};
    const narrativeStyle = (nConfig.narrativeStyle as string) || "THIRD_PERSON";
    const lang = shot.scene.project.language;
    const isZh = lang === "zh";

    const narrativePrompt =
      narrativeStyle === "FIRST_PERSON"
        ? isZh
          ? "【叙事风格】第一人称主观视角，带叙事旁白感。"
          : "[Narrative] First-person subjective perspective with voice-over tone. "
        : "";

    const charactersPrompt = shot.characters
      .map((c) => `${c.character.name}: ${c.character.description}`)
      .join(isZh ? "；" : "; ");

    const motionFromTable =
      (shot.videoPrompt && shot.videoPrompt.trim()) || shot.prompt || shot.imagePrompt;

    const elcineLine = isZh
      ? `【EL.CINE · 出片】参考图为 reference_image（约束风格与构图，非首帧锁定），视频内容完全由下方时间码脚本驱动，约 ${shot.duration ?? 15} 秒。`
      : `[EL.CINE · Render] Reference image is passed as reference_image (style/composition guide, NOT first-frame lock). Video is fully driven by the timestamped script below (~${shot.duration ?? 15}s).`;

    const deliverableLock = isZh
      ? `【成片约束】纯叙事实拍，连贯时空；参考图仅作风格参考，不得复刻原图。禁止出现分镜格线、九宫格框、制作板水印等制作素材。`
      : `[Deliverable lock] In-world photoreal footage, continuous time/space. Reference image guides style only — do not reproduce it literally. No grid lines, board watermarks, or PiP artifacts.`;

    // 把 videoPrompt 的运动描述包装为简报要求的时间码格式（5段×3秒=15秒）
    const duration = shot.duration ?? 15;
    const segSec = Math.floor(duration / 5);

    function buildTimeline(motionText: string, zh: boolean): string {
      // 提取 videoPrompt 里的 [SHOT SEQUENCE] 段作为动作核心
      const seqMatch = motionText.match(/\[SHOT SEQUENCE\]([\s\S]*?)(?=\*\*\[|$)/i);
      const camMatch = motionText.match(/\[CAMERA LANGUAGE\]([\s\S]*?)(?=\*\*\[|$)/i);
      const seqText = seqMatch?.[1]?.trim() ?? motionText.slice(0, 200);
      const camText = camMatch?.[1]?.trim() ?? (shot.cameraMove || "");

      const shotType = shot.type; // WIDE / MEDIUM / CLOSE_UP etc.
      const loc = shot.scene.location;

      if (zh) {
        return `# 场景语境：
${loc}${shot.scene.timeOfDay ? " · " + shot.scene.timeOfDay : ""}

# 旁白：
${narrativePrompt || "（第三人称叙事）"}

# 动作与运镜序列（${duration}秒时间轴）：
- 00:00–00:0${segSec}：[${shotType}] 建立情境，${seqText.split(/[。\n]/)[0] || "镜头缓慢推进"}。
- 00:0${segSec}–00:${String(segSec * 2).padStart(2, "0")}：[运镜] ${camText.split(/[，,\n]/)[0] || "跟拍主体进入画面"}。
- 00:${String(segSec * 2).padStart(2, "0")}–00:${String(segSec * 3).padStart(2, "0")}：[主体动作] ${seqText.split(/[。\n]/)[1] || "情绪升温，主体表演"}。
- 00:${String(segSec * 3).padStart(2, "0")}–00:${String(segSec * 4).padStart(2, "0")}：[情绪推进] ${seqText.split(/[。\n]/)[2] || "镜头随情绪收紧或放开"}。
- 00:${String(segSec * 4).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}：[收尾] 情绪落点或悬念钩，定格或横移收尾。

# 技术细节：
物理模拟：逼真的火焰、布料随风飘动、烟尘粒子。
镜头运动：${camText || "平滑推拉，35mm 变形宽银幕，浅景深"}。
色彩分级：依据场景情绪，高对比度，粗砺质感，低饱和度。`;
      } else {
        return `# Scene context:
${loc}${shot.scene.timeOfDay ? " · " + shot.scene.timeOfDay : ""}

# Narration:
${narrativePrompt || "(third-person cinematic)"}

# Motion & camera sequence (${duration}s timeline):
- 00:00–00:0${segSec}: [${shotType}] Establish — ${seqText.split(/[.\n]/)[0] || "slow push into scene"}.
- 00:0${segSec}–00:${String(segSec * 2).padStart(2, "0")}: [Camera] ${camText.split(/[,\n]/)[0] || "tracking subject entry"}.
- 00:${String(segSec * 2).padStart(2, "0")}–00:${String(segSec * 3).padStart(2, "0")}: [Action] ${seqText.split(/[.\n]/)[1] || "main action and emotion build"}.
- 00:${String(segSec * 3).padStart(2, "0")}–00:${String(segSec * 4).padStart(2, "0")}: [Escalate] ${seqText.split(/[.\n]/)[2] || "emotional peak or reversal"}.
- 00:${String(segSec * 4).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}: [Close] Emotional resolution or suspense hook — hold or lateral track out.

# Technical details:
Physics: realistic fire, cloth dynamics in wind, smoke/ash particles.
Camera: ${camText || "smooth push-pull, 35mm anamorphic, shallow DOF"}.
Color grading: scene-derived, high contrast, gritty texture, desaturated.`;
      }
    }

    const rowScriptCore = isZh
      ? `${elcineLine}\n${deliverableLock}\n\n${buildTimeline(motionFromTable || "", true)}\n\n【角色】${charactersPrompt}`
      : `${elcineLine}\n${deliverableLock}\n\n${buildTimeline(motionFromTable || "", false)}\n\n[Cast] ${charactersPrompt}`;

    const templated = wrapSeedancePart2Template(rowScriptCore, lang);
    const richPrompt = wrapCinematicPrompt(templated, lang);

    const rawVideo =
      (config.videoModel as string | undefined) ??
      (config.video as string | undefined) ??
      env.DEFAULT_VIDEO_MODEL;
    const videoModelKey = rawVideo as VideoModelKey;

    const refForVideo = dedupeUrls(refImageUrls).slice(0, SEEDANCE_MAX_REFERENCE_IMAGES);
    const videoRes = await generateVideo(
      {
        prompt: richPrompt,
        duration: shot.duration,
        cameraMove: shot.cameraMove ?? undefined,
        ratio: (config.aspectRatio as string) || "16:9",
        resolution: (config.resolution as string) || "1080p",
        refImageUrls: refForVideo.length > 0 ? refForVideo : undefined,
        volcengineAssetIds: volcengineAssetIds.length > 0 ? volcengineAssetIds : undefined,
        locale: shot.scene.project.language,
        generateAudio: true,
      },
      videoModelKey,
    );

    let videoUrl = videoRes.url;

    if (videoRes.taskId && !videoUrl) {
      videoUrl = await pollTask({
        taskId: videoRes.taskId,
        pollFn: pollSeedanceTask,
        job,
        stage: "video",
      });
    }

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
    log.info({ cost: videoRes.cost }, "[shot-worker] done");
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
