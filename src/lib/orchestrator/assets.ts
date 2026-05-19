import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateImage } from "@/lib/ai/image";
import { fetchAsBuffer, persistAsset } from "@/lib/ai/storage";
import { coerceImageModelKey } from "@/lib/orchestrator/project-image-model";
import { logger } from "@/lib/logger";

import { createAsset, createAssetGroup, pollAssetStatus } from "@/lib/ai/volcengine-assets";
import { queues } from "@/lib/queue/queues";
import { scrubForExternalImageApi, scrubNegativeForExternalImageApi } from "@/lib/orchestrator/safety";
import { textSuggestsUndeadOrSfxMakeup } from "@/lib/orchestrator/character-tone";

/**
 * Trigger Volcengine asset ingestion + audit (characters only — scenes/props use ref URLs in video).
 */
export async function triggerAssetIngestion({
  projectId,
  id,
  name,
  url,
}: {
  projectId: string;
  id: string;
  name: string;
  url: string;
}) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  let groupId = project.volcengineAssetGroupId;

  if (!groupId) {
    const group = await createAssetGroup(`${project.title}_assets`);
    groupId = group.Id;
    await db.project.update({ where: { id: projectId }, data: { volcengineAssetGroupId: groupId } });
  }

  const asset = await createAsset({
    groupId: groupId!,
    url,
    assetType: "Image",
    name,
  });

  await db.character.update({
    where: { id },
    data: {
      volcengineAssetId: asset.Id,
      volcengineStatus: "Processing",
    },
  });

  await queues.asset.add(`poll-${id}`, {
    assetId: asset.Id,
    projectId,
    characterId: id,
  }, {
    delay: 5000,
  });
}

/**
 * Download a provider URL (Tencent/OSS temporary) and re-persist to stable storage.
 * Provider URLs expire (minutes/hours); persisted URLs are long-lived.
 */
async function persistProviderImage(url: string, key: string): Promise<string> {
  const buf = await fetchAsBuffer(url);
  return persistAsset({ key, data: buf, contentType: "image/jpeg" });
}

export async function generateCharacterReference(characterId: string, modelKey?: string) {
  const char = await db.character.findUniqueOrThrow({ 
    where: { id: characterId },
    include: { project: true }
  }) as any;
  
  const isSystem = char.name.toLowerCase().includes("system") || char.name.includes("系统");
  const isChinese = char.project.language === "zh";
  const roleContext = [String(char.name ?? ""), String(char.description ?? ""), String(char.visualPrompt ?? "")]
    .join("\n");
  const undeadTone = !isSystem && textSuggestsUndeadOrSfxMakeup(roleContext);

  const prompt = isSystem
    ? isChinese
      ? `抽象高科技 AI 界面，${char.visualPrompt || char.description}，悬浮全息数据屏，发光粒子与数字极光，未来感 HUD，电影级布光，8K 超清，锐利对焦。`
      : `Abstract high-tech AI interface, ${char.visualPrompt || char.description}, floating holographic data screen, glowing ethereal particles, digital aurora, futuristic HUD, cinematic lighting, 8k uhd, sharp focus.`
    : undeadTone
      ? isChinese
        ? `全身三视图角色设定表（正、侧、背），电影级写实，真人演员佩戴专业感染体/虚弱病态特效化妆与假体（非真实伤亡、公映级审定尺度），东亚面孔在妆容下仍可辨认，着装严谨、画面尺度得当，肤质细节真实可信，${char.visualPrompt || char.description}，8K 超清，棚拍简洁背景，专业摄影布光，对焦锐利，中性戏剧体态，禁止卡通。`
        : `Full body three-view character sheet (front, side, back), cinematic photorealism, real Asian actor in professional infected-type sfx makeup and prosthetics (no real injury, broadcast-safe framing), modest wardrobe, believable skin texture, ${char.visualPrompt || char.description}, 8k uhd, studio background, professional lighting, sharp focus, neutral staged posture, not cartoon.`
      : isChinese
        ? `全身三视图角色设定表（正、侧、背），照片级真实人类，东亚中国面孔与体态，${char.visualPrompt || char.description}，8K 超清，皮肤质感细腻，自然光，棚拍简洁背景，对焦锐利，专业摄影，表情中性。`
        : `Full body three-view character sheet (front, side, back), photorealistic real human character, Western ethnicity, ${char.visualPrompt || char.description}, 8k uhd, highly detailed skin texture, natural lighting, studio background, sharp focus, professional photography, neutral expression.`;

  const negativePrompt = isSystem
    ? isChinese
      ? "人类，人物，脸，身体，动物，有机，杂乱，模糊，低画质"
      : "human, person, face, body, character, animal, organic, messy, blurry, low quality"
    : undeadTone
      ? isChinese
        ? "卡通，动漫，三渲二，插画，游戏 UI，画面杂质，非档案级质感，夸张肢体造型，模糊，低画质，多人杂乱合影，与设定不符的族裔外观"
        : "cartoon, anime, 3d render, illustration, game UI, busy overlays, off-model noise, exaggerated posing, blurry, low quality, crowd of unrelated extras, mismatched regional look"
      : isChinese
        ? "卡通，动漫，三渲二，插画，绘画，草图，虚幻引擎，游戏角色，风格化，CGI，模糊，低画质，畸形，多人，金发碧眼等西方面孔"
        : `cartoon, anime, 3d render, illustration, drawing, painting, sketch, unreal engine, game character, stylized, cgi, blurry, low quality, deformed, multiple people, Asian features`;
  
  const cfg = ((char.project?.modelConfig ?? {}) as Record<string, unknown>) || {};
  const imageModel = coerceImageModelKey(modelKey, cfg);

  const langApi: "zh" | "en" = isChinese ? "zh" : "en";
  const promptForApi = scrubForExternalImageApi(prompt, langApi);
  const negativeForApi = scrubNegativeForExternalImageApi(negativePrompt, langApi);

  let res: Awaited<ReturnType<typeof generateImage>>;
  try {
    res = await generateImage(
      {
        prompt: promptForApi,
        negativePrompt: negativeForApi,
        aspectRatio: "1:1",
        size: "2K",
      },
      imageModel,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const moderated =
      /moderation_blocked|rejected by the safety system|safety_violations/i.test(message);
    if (moderated && env.ALIBABA_DASHSCOPE_API_KEY) {
      logger.warn(
        { characterId, characterName: char.name, projectId: char.projectId, imageModel },
        "[assets] Tencent moderation blocked — one-shot fallback to wan2.7-image-pro",
      );
      try {
        res = await generateImage(
          {
            prompt: promptForApi,
            negativePrompt: negativeForApi,
            aspectRatio: "1:1",
            size: "2K",
          },
          "wan2.7-image-pro",
        );
      } catch (wanErr) {
        const wanMessage = wanErr instanceof Error ? wanErr.message : String(wanErr);
        logger.error(
          {
            characterId,
            characterName: char.name,
            projectId: char.projectId,
            imageModel,
            undeadTone,
            message,
            wanMessage,
            promptPreview: promptForApi.slice(0, 500),
          },
          "[assets] generateCharacterReference → Wan fallback also failed",
        );
        throw new Error(
          isChinese
            ? `主模型「${imageModel}」因安全/审核未通过，已自动改用阿里云万相备用通道；万相请求失败：${wanMessage}`
            : `Primary model "${imageModel}" failed (safety/moderation); Wan (DashScope) fallback then failed: ${wanMessage}`,
          { cause: wanErr instanceof Error ? wanErr : undefined },
        );
      }
    } else {
      logger.error(
        {
          characterId,
          characterName: char.name,
          projectId: char.projectId,
          imageModel,
          undeadTone,
          message,
          promptPreview: promptForApi.slice(0, 500),
        },
        "[assets] generateCharacterReference → generateImage failed",
      );
      throw err;
    }
  }
  
  const rawUrl = res.url;
  if (!rawUrl)
    throw new Error(
      isChinese
        ? `未能为角色 ${char.name} 生成参考图：服务商未返回 URL。`
        : `Failed to generate character reference image for ${char.name}: Provider returned no URL.`,
    );

  // Persist provider URL → stable storage
  const refImageUrl = await persistProviderImage(
    rawUrl,
    `projects/${char.projectId}/characters/${char.id}.jpg`,
  ).catch(async (persistErr) => {
    logger.warn(
      { characterId, err: String(persistErr) },
      "[assets] persistProviderImage failed — saving raw URL instead",
    );
    return rawUrl;
  });

  await db.character.update({ where: { id: characterId }, data: { refImageUrl } });

  try {
    await triggerAssetIngestion({
      projectId: char.projectId,
      id: char.id,
      name: char.name,
      url: refImageUrl,
    });
  } catch (ingestErr: unknown) {
    logger.warn(
      {
        characterId,
        characterName: char.name,
        projectId: char.projectId,
        err: ingestErr instanceof Error ? ingestErr.message : String(ingestErr),
      },
      "[assets] Volcengine CreateAsset failed — ref image URL is saved; retry audit later or check Volcengine status",
    );
  }

  return refImageUrl;
}

export async function generateSceneReference(sceneId: string, modelKey?: string) {
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId }, include: { project: true } });
  const isChinese = scene.project.language === "zh";
  const prompt = isChinese
    ? `电影感大远景，建筑/风光摄影，中国地域风格与环境，${scene.location}，${scene.timeOfDay || "日光"}，细节丰富，材质真实，专业布光，环境风格统一。`
    : `Cinematic wide shot, architectural/landscape photography, Western regional style, ${scene.location}, ${scene.timeOfDay || "daylight"}, highly detailed, realistic textures, professional lighting, consistent environment style.`;
  const langApi = isChinese ? "zh" : "en";
  const promptForApi = scrubForExternalImageApi(prompt, langApi);

  const cfg = ((scene.project?.modelConfig ?? {}) as Record<string, unknown>) || {};
  const imageModel = coerceImageModelKey(modelKey, cfg);

  const res = await generateImage(
    {
      prompt: promptForApi,
      aspectRatio: "16:9",
      size: "2K",
    },
    imageModel,
  );
  
  const rawUrl = res.url;
  if (!rawUrl)
    throw new Error(
      isChinese
        ? `未能为场景「${scene.location}」生成参考图：服务商未返回 URL。`
        : `Failed to generate scene reference image for ${scene.location}: Provider returned no URL.`,
    );

  // Persist provider URL → stable storage
  const refImageUrl = await persistProviderImage(
    rawUrl,
    `projects/${scene.projectId}/scenes/${scene.id}.jpg`,
  ).catch(async (persistErr) => {
    logger.warn(
      { sceneId, err: String(persistErr) },
      "[assets] persistProviderImage failed — saving raw URL instead",
    );
    return rawUrl;
  });

  // Scene reference images are not ingested into Volcengine (no audit pipeline for scenes).
  await db.scene.update({
    where: { id: sceneId },
    data: {
      refImageUrl,
      volcengineAssetId: null,
      volcengineStatus: null,
    },
  });

  return refImageUrl;
}

/**
 * Re-submit Volcengine ingestion for characters that have a ref image
 * but whose Volcengine asset is missing or previously failed.
 * Safe to call at the start of every asset-generation stage.
 */
export async function resubmitFailedCharacterAudits(projectId: string) {
  const chars = await db.character.findMany({
    where: {
      projectId,
      refImageUrl: { not: null },
      OR: [{ volcengineAssetId: null }, { volcengineStatus: "Failed" }],
    },
  });
  if (chars.length === 0) return;
  logger.info({ projectId, count: chars.length }, "[assets] re-submitting failed/missing Volcengine audits");
  for (const char of chars) {
    try {
      await triggerAssetIngestion({
        projectId,
        id: char.id,
        name: char.name,
        url: char.refImageUrl!,
      });
    } catch (err) {
      logger.error({ charId: char.id, err }, "[assets] re-submit failed — continuing");
    }
  }
}

/**
 * Block until every character with a volcengineAssetId reaches "Active" or "Failed".
 * Polls the DB (updated by the BullMQ asset worker) instead of calling Volcengine directly.
 * Falls through after timeoutMs to avoid blocking the pipeline indefinitely.
 */
export async function waitForCharacterAudits(
  projectId: string,
  timeoutMs = 8 * 60 * 1000,
  intervalMs = 6000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // User clicked "confirm assets ready" — skip waiting immediately.
    const proj = await db.project.findUnique({ where: { id: projectId }, select: { modelConfig: true } });
    const cfg = (proj?.modelConfig as Record<string, unknown>) ?? {};
    if (cfg.assetsConfirmed === true) {
      logger.info({ projectId }, "[assets] assetsConfirmed flag set — skipping audit wait");
      return;
    }

    const chars = await db.character.findMany({
      where: { projectId, volcengineAssetId: { not: null } },
      select: { id: true, name: true, volcengineStatus: true },
    });

    // Directly poll any that are still stuck in "Processing" so we don't solely depend on BullMQ worker
    for (const c of chars) {
      if (c.volcengineStatus !== "Active" && c.volcengineStatus !== "Failed") {
        const char = await db.character.findUniqueOrThrow({ where: { id: c.id } });
        if (!char.volcengineAssetId) continue;
        try {
          const status = await pollAssetStatus(char.volcengineAssetId);
          if (status === "Active" || status === "Failed") {
            await db.character.update({ where: { id: c.id }, data: { volcengineStatus: status } });
          }
        } catch (err) {
          logger.warn({ charId: c.id, err }, "[assets] poll Volcengine status failed");
        }
      }
    }

    const pending = chars.filter(
      (c) => c.volcengineStatus !== "Active" && c.volcengineStatus !== "Failed",
    );
    if (pending.length === 0) {
      logger.info({ projectId }, "[assets] all Volcengine character audits resolved");
      return;
    }

    logger.info(
      { projectId, pending: pending.map((c) => c.name) },
      `[assets] waiting for ${pending.length} character audit(s)…`,
    );
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  logger.warn({ projectId }, "[assets] Volcengine audit wait timed out — proceeding to storyboard anyway");
}

export async function generatePropReference(propId: string, modelKey?: string) {
  const prop = await db.prop.findUniqueOrThrow({ 
    where: { id: propId }, 
    include: { scene: { include: { project: true } } } 
  });
  const isChinese = prop.scene.project.language === "zh";
  const prompt = isChinese
    ? `棚拍静物产品照，中国风道具「${prop.name}」，电影布光，简洁背景，对焦锐利，材质高保真。`
    : `Studio product photography of ${prop.name}, cinematic lighting, isolated on simple background, sharp focus, high-fidelity materials.`;
  const langApi = isChinese ? "zh" : "en";
  const promptForApi = scrubForExternalImageApi(prompt, langApi);

  const cfg = ((prop.scene.project?.modelConfig ?? {}) as Record<string, unknown>) || {};
  const imageModel = coerceImageModelKey(modelKey, cfg);

  const res = await generateImage(
    {
      prompt: promptForApi,
      aspectRatio: "1:1",
      size: "2K",
    },
    imageModel,
  );
  
  const rawUrl = res.url;
  if (!rawUrl)
    throw new Error(
      isChinese
        ? `未能为道具「${prop.name}」生成参考图：服务商未返回 URL。`
        : `Failed to generate prop reference image for ${prop.name}: Provider returned no URL.`,
    );

  // Persist provider URL → stable storage
  const refImageUrl = await persistProviderImage(
    rawUrl,
    `projects/${prop.scene.projectId}/props/${prop.id}.jpg`,
  ).catch(async (persistErr) => {
    logger.warn(
      { propId, err: String(persistErr) },
      "[assets] persistProviderImage failed — saving raw URL instead",
    );
    return rawUrl;
  });

  await db.prop.update({
    where: { id: propId },
    data: {
      refImageUrl,
      volcengineAssetId: null,
      volcengineStatus: null,
    },
  });

  return refImageUrl;
}
