"use server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { parseScript } from "./parser.agent";
import {
  generateCharacterReference,
  generateSceneReference,
  generatePropReference,
  resubmitFailedCharacterAudits,
  waitForCharacterAudits,
} from "./assets";
import { filterSensitiveWords } from "./safety";
import { runPool } from "./pipeline-concurrency";
import { runEcpStoryboardForProject, ensureTranslatedRawScript } from "./director";
import { fanoutAssetsAndCompose } from "@/lib/queue/flows";
import { dispatchPipeline } from "@/lib/queue/flows";

const DEMO_USER_ID = "system";

// ─────────────────────────────────────────────
// 工具：生成 cuid-like ID（服务端用）
// ─────────────────────────────────────────────
function cuid(): string {
  // 使用 crypto 生成足够唯一的 ID（与 prisma cuid() 兼容格式）
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `c${ts}${rand}`;
}

// ─────────────────────────────────────────────
// 模式 B：连载追加 — 创建 Series（含第 1 集）
// ─────────────────────────────────────────────
export async function createSeriesWithFirstEpisode(args: {
  title: string;
  language: string;
  rawScript: string;
  inputType: "SCRIPT" | "NOVEL";
  modelConfig: Record<string, unknown>;
}): Promise<{ seriesId: string; projectId: string }> {
  const user = await db.user.upsert({
    where: { email: "system@onestoryboard.local" },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "system@onestoryboard.local",
      name: "System",
      plan: "PRO",
      credits: 999999,
    },
  });

  const series = await db.series.create({
    data: {
      id: cuid(),
      title: args.title,
      language: args.language,
      mode: "SERIAL",
      userId: user.id,
    },
  });

  const project = await db.project.create({
    data: {
      title: args.language === "en" ? `${args.title} Episode 1` : `${args.title} 第1集`,
      episodeCount: 1,
      language: args.language,
      userId: user.id,
      rawScript: args.rawScript,
      seriesId: series.id,
      seriesEpisodeNumber: 1,
      modelConfig: {
        ...args.modelConfig,
        inputType: args.inputType,
      },
    },
  });

  logger.info({ seriesId: series.id, projectId: project.id }, "[series] created Series + Episode 1");
  return { seriesId: series.id, projectId: project.id };
}

// ─────────────────────────────────────────────
// 模式 A：整部导入 — 按 [[EPISODE X]] 拆分创建 Series
// ─────────────────────────────────────────────
export async function createSeriesFromFullScript(args: {
  title: string;
  language: string;
  rawScript: string;
  inputType: "SCRIPT" | "NOVEL";
  modelConfig: Record<string, unknown>;
}): Promise<{ seriesId: string; projectIds: string[] }> {
  const user = await db.user.upsert({
    where: { email: "system@onestoryboard.local" },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "system@onestoryboard.local",
      name: "System",
      plan: "PRO",
      credits: 999999,
    },
  });

  // 按 [[EPISODE X]] 或 [[CHAPTER X]] 拆分
  const episodes = splitByEpisodeMarker(args.rawScript);
  const totalEpisodes = episodes.length;

  logger.info({ title: args.title, totalEpisodes }, "[series] FULL import split");

  const series = await db.series.create({
    data: {
      id: cuid(),
      title: args.title,
      language: args.language,
      mode: "FULL",
      userId: user.id,
    },
  });

  const projectIds: string[] = [];
  for (let i = 0; i < episodes.length; i++) {
    const epNum = i + 1;
    const project = await db.project.create({
      data: {
        title: args.language === "en" ? `${args.title} Episode ${epNum}` : `${args.title} 第${epNum}集`,
        episodeCount: 1,
        language: args.language,
        userId: user.id,
        rawScript: episodes[i]!,
        seriesId: series.id,
        seriesEpisodeNumber: epNum,
        modelConfig: {
          ...args.modelConfig,
          inputType: args.inputType,
        },
      },
    });
    projectIds.push(project.id);
  }

  logger.info({ seriesId: series.id, projectIds }, "[series] FULL import — all episodes created");
  return { seriesId: series.id, projectIds };
}

// ─────────────────────────────────────────────
// 连载：追加新集（复用 Series 角色池）
// ─────────────────────────────────────────────
export async function appendEpisodeToSeries(args: {
  seriesId: string;
  rawScript: string;
  inputType?: "SCRIPT" | "NOVEL";
}): Promise<{ projectId: string; episodeNumber: number }> {
  const series = await db.series.findUniqueOrThrow({
    where: { id: args.seriesId },
    include: { episodes: { orderBy: { seriesEpisodeNumber: "asc" } } },
  });

  const nextEpNum =
    Math.max(0, ...series.episodes.map((e) => e.seriesEpisodeNumber ?? 0)) + 1;

  // 取第 1 集的 modelConfig 作为基准
  const firstEp = series.episodes[0];
  const baseConfig = (firstEp?.modelConfig as Record<string, unknown>) ?? {};

  const project = await db.project.create({
    data: {
      title: series.language === "en" ? `${series.title} Episode ${nextEpNum}` : `${series.title} 第${nextEpNum}集`,
      episodeCount: 1,
      language: series.language,
      userId: series.userId,
      rawScript: args.rawScript,
      seriesId: series.id,
      seriesEpisodeNumber: nextEpNum,
      modelConfig: {
        ...baseConfig,
        inputType: args.inputType ?? baseConfig.inputType ?? "SCRIPT",
      },
    },
  });

  logger.info(
    { seriesId: series.id, projectId: project.id, episodeNumber: nextEpNum },
    "[series] appended Episode",
  );

  return { projectId: project.id, episodeNumber: nextEpNum };
}

// ─────────────────────────────────────────────
// Pipeline：带角色池复用的完整流水线
// 在 parse worker 里调用，替代普通 runParseAndStoryboard
// ─────────────────────────────────────────────
export async function runSeriesEpisodePipeline(projectId: string): Promise<void> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const config = (project.modelConfig as Record<string, unknown>) ?? {};
  const textModel = (config.textModel as string) || env.DEFAULT_TEXT_MODEL;
  const inputType = (config.inputType as string) || "SCRIPT";
  const narrativeStyle = (config.narrativeStyle as string) || "THIRD_PERSON";
  const imageModel = (config.imageModel as string) || env.DEFAULT_IMAGE_MODEL;

  if (!project.seriesId) {
    // 非 Series 项目，走普通流水线
    const { runParseAndStoryboard } = await import("./director");
    await runParseAndStoryboard(projectId);
    return;
  }

  const seriesId = project.seriesId;
  logger.info({ projectId, seriesId }, "[series-pipeline] start");

  // ── Stage 1: Parse ──────────────────────────────────────────────────
  await db.project.update({
    where: { id: projectId },
    data: { pipelineStage: "PARSING", status: "GENERATING", startedAt: new Date(), errorMessage: null },
  });

  // Translate rawScript to match project language before parsing
  const translatedRaw = await ensureTranslatedRawScript(
    projectId,
    project.rawScript,
    project.language,
    textModel as any,
  );

  const parsed = await parseScript(
    translatedRaw,
    1, // 每个 Project 只有 1 集
    project.language,
    textModel as any,
    inputType as "SCRIPT" | "NOVEL",
    narrativeStyle as "THIRD_PERSON" | "FIRST_PERSON",
  );

  if (!parsed.scenes?.length) {
    throw new Error(
      project.language === "en"
        ? "Parse result is empty: no scenes or characters found in the script. Try adding more content or adjusting the split settings."
        : "解析结果为空：未识别到任何场次。",
    );
  }

  // ── Stage 2: 角色池复用 ─────────────────────────────────────────────
  // 从 Series 角色池取已有角色（有 refImageUrl + volcengineAssetId）
  const seriesChars = await db.seriesCharacter.findMany({ where: { seriesId } });
  const seriesCharMap = new Map(seriesChars.map((c) => [c.name, c]));

  // 写入本集 Scene + Character（复用已有资产）
  await db.$transaction(async (tx) => {
    await tx.scene.deleteMany({ where: { projectId } });
    await tx.character.deleteMany({ where: { projectId } });

    for (const scene of parsed.scenes) {
      const locationStored = filterSensitiveWords(scene.location);
      await tx.scene.create({
        data: {
          projectId,
          episodeNumber: 1,
          order: scene.order,
          location: locationStored,
          timeOfDay: scene.timeOfDay,
          scriptText: filterSensitiveWords(scene.scriptText),
          props: {
            create: scene.props.map((name) => ({
              name: filterSensitiveWords(name),
            })),
          },
        },
      });
    }

    for (const c of parsed.characters) {
      const nameStored = filterSensitiveWords(c.name);
      // 优先从 Series 角色池复用
      const pool = seriesCharMap.get(c.name) ?? seriesCharMap.get(nameStored);
      await tx.character.create({
        data: {
          projectId,
          name: nameStored,
          description: filterSensitiveWords(c.description),
          personality: c.personality,
          background: c.background,
          visualPrompt: c.visualPrompt,
          // 复用 Series 池里的资产
          refImageUrl: pool?.refImageUrl ?? null,
          volcengineAssetId: pool?.volcengineAssetId ?? null,
          volcengineStatus: pool?.volcengineStatus ?? null,
        },
      });
    }
  });

  // ── Stage 3: Asset Generation ───────────────────────────────────────
  await db.project.update({ where: { id: projectId }, data: { pipelineStage: "ASSET_GENERATION" } });

  const projectWithAssets = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { characters: true, scenes: { include: { props: true } } },
  });

  const imageConc = env.PIPELINE_IMAGE_CONCURRENCY;

  // 只为没有 refImageUrl 的角色生成（已从 Series 复用的跳过）
  const charsNeedingRef = projectWithAssets.characters.filter((c) => !c.refImageUrl);
  if (charsNeedingRef.length > 0) {
    logger.info({ projectId, count: charsNeedingRef.length }, "[series-pipeline] generating new character refs");
    await runPool(charsNeedingRef, imageConc, async (char) => {
      try {
        await generateCharacterReference(char.id, imageModel);
        // 生成完后同步到 Series 角色池
        const updated = await db.character.findUnique({ where: { id: char.id } });
        if (updated?.refImageUrl) {
          await db.seriesCharacter.upsert({
            where: { seriesId_name: { seriesId, name: updated.name } },
            update: {
              refImageUrl: updated.refImageUrl,
              volcengineAssetId: updated.volcengineAssetId,
              volcengineStatus: updated.volcengineStatus,
              description: updated.description ?? undefined,
              personality: updated.personality ?? undefined,
              background: updated.background ?? undefined,
              visualPrompt: updated.visualPrompt ?? undefined,
            },
            create: {
              id: cuid(),
              seriesId,
              name: updated.name,
              description: updated.description,
              personality: updated.personality,
              background: updated.background,
              visualPrompt: updated.visualPrompt,
              refImageUrl: updated.refImageUrl,
              volcengineAssetId: updated.volcengineAssetId,
              volcengineStatus: updated.volcengineStatus,
            },
          });
          logger.info({ seriesId, charName: updated.name }, "[series-pipeline] synced new char to Series pool");
        }
      } catch (err) {
        logger.error({ charId: char.id, err }, "[series-pipeline] character asset failed");
      }
    });
  } else {
    logger.info({ projectId }, "[series-pipeline] all characters reused from Series pool — skipping asset gen");
  }

  await resubmitFailedCharacterAudits(projectId);
  await waitForCharacterAudits(projectId);

  // 同步 volcengineStatus 变更回 Series 池
  const updatedChars = await db.character.findMany({ where: { projectId } });
  for (const c of updatedChars) {
    if (c.volcengineAssetId) {
      await db.seriesCharacter.upsert({
        where: { seriesId_name: { seriesId, name: c.name } },
        update: {
          volcengineAssetId: c.volcengineAssetId,
          volcengineStatus: c.volcengineStatus,
        },
        create: {
          id: cuid(),
          seriesId,
          name: c.name,
          description: c.description,
          personality: c.personality,
          background: c.background,
          visualPrompt: c.visualPrompt,
          refImageUrl: c.refImageUrl,
          volcengineAssetId: c.volcengineAssetId,
          volcengineStatus: c.volcengineStatus,
        },
      });
    }
  }

  // 场景 + 道具参考图
  const sceneTasks = projectWithAssets.scenes.filter((s) => !s.refImageUrl);
  const propTasks = projectWithAssets.scenes.flatMap((s) => s.props.filter((p) => !p.refImageUrl));

  if (sceneTasks.length > 0) {
    await runPool(sceneTasks, imageConc, async (scene) => {
      try { await generateSceneReference(scene.id, imageModel); } catch (err) {
        logger.error({ sceneId: scene.id, err }, "[series-pipeline] scene ref failed");
      }
    });
  }
  // 道具参考图
  if (propTasks.length > 0) {
    await runPool(propTasks, imageConc, async (prop) => {
      try { await generatePropReference(prop.id, imageModel); } catch (err) {
        logger.warn({ propId: prop.id, err }, "[series-pipeline] prop ref failed");
      }
    });
  }

  // ── Stage 4: ECP Storyboard ─────────────────────────────────────────
  await runEcpStoryboardForProject(projectId);

  // ── Stage 5: Fanout → Shot workers → Compose ────────────────────────
  await fanoutAssetsAndCompose(projectId);

  logger.info({ projectId, seriesId }, "[series-pipeline] done");
}

// ─────────────────────────────────────────────
// 工具函数：按 [[EPISODE X]] / [[CHAPTER X]] 拆分全文
// ─────────────────────────────────────────────
import { splitByEpisodeMarker } from "./episode-splitter";
export { splitByEpisodeMarker };
