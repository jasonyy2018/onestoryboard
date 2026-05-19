import { Worker, Job } from "bullmq";
import { z } from "zod";
import { createBullConnection } from "@/lib/queue/connection";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateVideo, pollSeedanceTask } from "@/lib/ai/video";
import { createAssetGroup, ingestImageFromBuffer, pollAssetStatus } from "@/lib/ai/volcengine-assets";
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

/** Simple string hash for stable seed (FNV-1a 32-bit). */
function crc32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

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
 * Extends the BullMQ job lock every EXTEND_LOCK_EVERY_MS to prevent stalling.
 */
const EXTEND_LOCK_EVERY_MS = 4 * 60 * 1000; // extend lock every 4 min

async function pollTask<T>(args: {
  taskId: string;
  pollFn: (id: string) => Promise<{ url?: string; urls?: string[]; status: string }>;
  job: Job;
  stage: string;
  maxRetries?: number;
  intervalMs?: number;
}): Promise<string> {
  const { taskId, pollFn, job, stage, maxRetries = 240, intervalMs = 5000 } = args;
  let lastExtend = Date.now();

  for (let i = 0; i < maxRetries; i++) {
    // Extend lock before it expires (lockDuration is 45 min, extend every 4 min)
    if (Date.now() - lastExtend >= EXTEND_LOCK_EVERY_MS) {
      try {
        await job.extendLock(job.token ?? "", 45 * 60 * 1000);
        lastExtend = Date.now();
      } catch (extErr) {
        logger.warn({ stage, taskId, extErr }, "[pollTask] extendLock failed (continuing)");
      }
    }

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

      const MAX_KEYFRAME_RETRIES = 3;
      let persistedKey: string | null = null;
      let imgRes: Awaited<ReturnType<typeof generateImage>> | undefined;
      for (let kfAttempt = 1; kfAttempt <= MAX_KEYFRAME_RETRIES; kfAttempt++) {
        if (kfAttempt > 1) {
          log.warn({ attempt: kfAttempt }, "[shot-worker] retrying keyframe generation");
          await new Promise((r) => setTimeout(r, 2000));
        }

        imgRes = await generateImage(
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

        try {
          const imgBuf = await fetchAsBuffer(imgRes.url);
          persistedKey = await persistAsset({
            key: `projects/${projectId}/shots/${shotId}-keyframe.jpg`,
            data: imgBuf,
            contentType: "image/jpeg",
          });
          break;
        } catch (fetchErr) {
          const fm = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          const isExpired = fm.includes("403") || fm.includes("expire") || fm.includes("Expires");
          if (isExpired && kfAttempt < MAX_KEYFRAME_RETRIES) {
            log.warn({ attempt: kfAttempt, err: fm }, "[shot-worker] keyframe URL expired, regenerating...");
            continue;
          }
          throw fetchErr;
        }
      }

      if (!persistedKey) throw new Error("Failed to persist storyboard keyframe after retries");

      storyboardKeyUrl = persistedKey;

      await db.shot.update({
        where: { id: shotId },
        data: {
          imageUrl: persistedKey,
          status: "IMAGE_READY",
          cost: { increment: imgRes?.cost ?? 0 },
        },
      });
      await db.project.update({
        where: { id: projectId },
        data: { totalCost: { increment: imgRes?.cost ?? 0 } },
      });

      await job.updateProgress({ stage: "keyframe-done", percent: 35 });
      log.info({ cost: imgRes?.cost ?? 0, url: persistedKey }, "[shot-worker] ✓ Part1 keyframe done");
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
    // 自动检测 asset 是否在当前 project（VOLCENGINE_PROJECT_NAME）有效：
    //   - 有效（Active）→ 直接使用
    //   - 不存在（旧 default project 的 ID）→ 用 refImageUrl 重新入库到正确 project，更新 DB
    const volcengineAssetIds: string[] = [];
    const directCharUrls: string[] = [];

    for (const sc of shot.characters) {
      const c = sc.character;
      if (!c.refImageUrl) continue;
      if (volcengineAssetIds.length + directCharUrls.length >= 2) break;

      // ── 优先走 asset:// 通道（报白资产，免人脸审核） ──
      if (c.volcengineAssetId) {
        try {
          const assetInfo = await pollAssetStatus(c.volcengineAssetId);
          if (assetInfo === "Active") {
            volcengineAssetIds.push(c.volcengineAssetId);
            log.info({ assetId: c.volcengineAssetId, char: c.name }, "[shot-worker] ✓ asset valid");
            continue;
          }
          log.warn({ assetId: c.volcengineAssetId, status: assetInfo, char: c.name }, "[shot-worker] asset not Active, will retry or fallback");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes("not found") || errMsg.includes("NotFound")) {
            log.info({ char: c.name }, "[shot-worker] asset not in project, re-ingesting...");
            try {
              const proj = await db.project.findUniqueOrThrow({ where: { id: projectId } });
              let groupId = proj.volcengineAssetGroupId;
              if (!groupId) {
                const group = await createAssetGroup(`${proj.title}_assets`);
                groupId = group.Id;
                await db.project.update({ where: { id: projectId }, data: { volcengineAssetGroupId: groupId } });
              }
              const imgBuf = await fetchAsBuffer(c.refImageUrl);
              const newAssetId = await ingestImageFromBuffer({ groupId: groupId!, buffer: imgBuf, name: c.name });
              await db.character.update({
                where: { id: c.id },
                data: { volcengineAssetId: newAssetId, volcengineStatus: "Active" },
              });
              volcengineAssetIds.push(newAssetId);
              log.info({ newAssetId, char: c.name }, "[shot-worker] ✓ re-ingested");
              continue;
            } catch (reErr) {
              log.warn({ err: reErr, char: c.name }, "[shot-worker] re-ingestion failed");
            }
          } else {
            log.warn({ err: errMsg, char: c.name }, "[shot-worker] asset check failed");
          }
        }
      }

      // ── Fallback: 用直接 URL 作为角色参考（可能触发人脸审核，但优于无参考） ──
      directCharUrls.push(c.refImageUrl);
    }

    // 混合排序：asset:// 排前面（免审），URL fallback 排后面
    const allCharRefs = [...volcengineAssetIds, ...directCharUrls];
    if (allCharRefs.length === 0) {
      log.warn("[shot-worker] no character reference images at all — generating without reference image");
    } else {
      log.info(
        { assetIds: volcengineAssetIds.length, directUrls: directCharUrls.length },
        "[shot-worker] character references ready",
      );
    }

    const nConfig = (shot.scene.project.modelConfig as Record<string, unknown>) || {};
    const narrativeStyle = (nConfig.narrativeStyle as string) || "THIRD_PERSON";
    const lang = shot.scene.project.language;
    const isZh = lang === "zh";

    const motionFromTable =
      (shot.videoPrompt && shot.videoPrompt.trim()) || shot.prompt || shot.imagePrompt;

    // 角色外貌锁定：同时注入 description + visualPrompt，强制东亚面孔约束
    const charactersPrompt = shot.characters
      .map((c) => {
        const visual = c.character.visualPrompt ? `（外貌：${c.character.visualPrompt}）` : "";
        const visualEn = c.character.visualPrompt ? ` (appearance: ${c.character.visualPrompt})` : "";
        return isZh
          ? `${c.character.name}: ${c.character.description}${visual}`
          : `${c.character.name}: ${c.character.description}${visualEn}`;
      })
      .join(isZh ? "；\n" : "; \n");

    const loc = shot.scene.location;
    const timeOfDay = shot.scene.timeOfDay ? ` · ${shot.scene.timeOfDay}` : "";

    // 旁白模式：根据 narrativeStyle 决定旁白类型和镜头风格
    const narrativeLabel = isZh ? "# 旁白风格：" : "# Narration style:";
    const narrativeValue = narrativeStyle === "FIRST_PERSON"
      ? isZh
        ? "第一人称主观视角（POV）。观众即主角。画面须以主观手持跟拍或 POV 镜头呈现，同期声包含主角低沉的内心独白旁白（画外音 V.O.），语速舒缓、情绪克制、带气息感。禁止出现主角正脸直视镜头（除非剧本明确要求）。"
        : "First-person subjective POV. Viewer IS the protagonist. Use handheld POV or first-person camera. Include protagonist's quiet internal monologue as voice-over (V.O.) in the same-source audio, slow pace, restrained emotion, breathy tone. Avoid protagonist facing camera directly unless script demands it."
      : narrativeStyle === "NOVEL_VO"
        ? isZh
          ? "第三人称电影叙事，多机位客观覆盖。配以小说式旁白（画外音 V.O.），以文学朗读风格讲述场景与情节，语速舒缓、叙述性强，类似有声小说。画面如同「说书人在讲故事时同步演出的情景」，角色沉浸在自己的世界里，不直视镜头。"
          : "Third-person cinematic narration, objective multi-angle coverage. Accompanied by novel-style voice-over (V.O.) in literary reading style — calm pace, narrative tone, like an audiobook brought to life with live-action visuals. Characters inhabit their own world, never acknowledging the camera."
        : isZh ? "第三人称电影叙事，多机位客观覆盖。" : "Third-person cinematic narration, objective multi-angle coverage.";
    
    // 提取旁白文字（支持第一人称内心独白和小说旁白两种模式）
    let voiceoverBlock = "";
    if ((narrativeStyle === "FIRST_PERSON" || narrativeStyle === "NOVEL_VO") && motionFromTable) {
      // 匹配 [PRODUCTION NOTES] 段落或「旁白：」「V.O.:」等标记后的文字
      const voMatch = motionFromTable.match(
        /(?:\[PRODUCTION NOTES\]|旁白[：:：]|V\.O\.[：:：]?|画外音[：:：]?)([\s\S]*?)(?:\n\[|\n#|$)/i,
      );
      if (voMatch && voMatch[1]?.trim()) {
        const voLabel = narrativeStyle === "NOVEL_VO"
          ? isZh
            ? "小说旁白（第三人称 V.O.，画外音朗读，同期声输出）"
            : "Novel narration (third-person V.O., voice-over reading, diegetic audio)"
          : isZh
            ? "画外音旁白（第一人称 V.O.，须出现在同期声中）"
            : "Voice-over narration (first-person V.O., must appear in diegetic audio)";
        voiceoverBlock = `\n# ${voLabel}：\n${voMatch[1].trim()}`;
      }
    }

    const rowScriptCore = isZh
      ? `# 场景：${loc}${timeOfDay}\n${narrativeLabel}\n${narrativeValue}${voiceoverBlock}\n\n# 角色外貌锁定（严格遵守，禁止替换为西方面孔）：\n${charactersPrompt}\n\n# 镜头运动：${shot.cameraMove || "平滑推拉，浅景深"}\n\n# 视频脚本（严格按节拍顺序执行）：\n${motionFromTable}`
      : `# Scene: ${loc}${timeOfDay}\n${narrativeLabel}\n${narrativeValue}${voiceoverBlock}\n\n# Cast appearance lock (strictly follow character descriptions — do not alter ethnicity, facial features, or build):\n${charactersPrompt}\n\n# Camera: ${shot.cameraMove || "smooth push-pull, shallow DOF"}\n\n# Video script (execute in strict beat order):\n${motionFromTable}`;

    const templated = wrapSeedancePart2Template(rowScriptCore, lang);
    const richPrompt = wrapCinematicPrompt(templated, lang);

    // Part 2 参考图：故事板图 + 场景参考 + 道具参考 + 角色 URL fallback（作为直接 URL 传入）
    // 角色优先走 asset:// 通道（国人脸免审），无 asset:// 时用 refImageUrl 直接 URL 降级
    // 场景/道具不含人脸所以直接传 URL
    const extraRefs: string[] = [];
    if (shot.scene.refImageUrl) extraRefs.push(shot.scene.refImageUrl);
    for (const p of shot.scene.props) {
      if (p.refImageUrl && extraRefs.length < 3) extraRefs.push(p.refImageUrl);
    }
    const refForVideo = dedupeUrls([
      ...(storyboardKeyUrl ? [storyboardKeyUrl] : []),
      ...extraRefs,
      ...directCharUrls,
    ]).slice(0, SEEDANCE_MAX_REFERENCE_IMAGES);

    // ── Multi-shot continuity ──
    // Fixed seed from project ID ensures reproducible outputs across shots.
    const stableSeed = crc32(projectId);
    // Attempt to chain from the previous shot's last frame (same scene, same episode).
    let firstFrameUrl: string | undefined;
    if (shot.order > 1) {
      const prev = await db.shot.findFirst({
        where: { sceneId: shot.sceneId, order: shot.order - 1, lastFrameUrl: { not: null } },
        select: { lastFrameUrl: true },
      });
      if (prev?.lastFrameUrl) firstFrameUrl = prev.lastFrameUrl;
    }

    log.info(
      { model: "seedance-2.0-fast", refImages: refForVideo.length, assetIds: volcengineAssetIds.length, duration: shot.duration, seed: stableSeed, hasPrevFrame: !!firstFrameUrl },
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
        seed: stableSeed,
        firstFrameUrl,
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

    // Extract last frame URL for shot continuity (query once more since task is done)
    let lastFrameUrl: string | undefined;
    if (videoRes.taskId) {
      try {
        const final = await pollSeedanceTask(videoRes.taskId);
        lastFrameUrl = final.lastFrameUrl;
      } catch { /* non-critical */ }
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
        lastFrameUrl,
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
    // pollTask 内部每 4 分钟调用 extendLock，初始锁需覆盖第一次 extend 前的时间
    lockDuration: 45 * 60 * 1000,  // 45 分钟初始锁
    stalledInterval: 60 * 1000,
    maxStalledCount: 3,
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
