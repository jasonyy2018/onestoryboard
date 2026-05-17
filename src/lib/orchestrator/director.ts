import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { parseScript } from "./parser.agent";
import { generateStoryboard } from "./storyboard.agent";
import {
  generateCharacterReference,
  generateSceneReference,
  generatePropReference,
  resubmitFailedCharacterAudits,
  waitForCharacterAudits,
} from "./assets";
import { filterSensitiveWords } from "./safety";
import { runPool } from "./pipeline-concurrency";
import { analyzeAssets } from "@/lib/agents/analyze-assets.agent";
import { normalizeDramaScript } from "@/lib/agents/normalize-drama-script.agent";
import { createEpisodeScript } from "@/lib/agents/create-episode-script.agent";
import type { TextModelKey } from "@/lib/ai/text";

/**
 * 文件级状态检测：通过检查数据库记录判断当前阶段
 * 参考 ArcReel 的文件系统状态检测模式，使用 DB 替代文件系统
 */
export type PipelineStage =
  | "IDLE"
  | "PARSING"
  | "ASSET_EXTRACTION"
  | "ASSET_GENERATION"
  | "SCRIPT_NORMALIZATION"
  | "EPISODE_SCRIPT"
  | "STORYBOARDING"
  | "DONE";

export async function detectCurrentStage(projectId: string): Promise<PipelineStage> {
  const [sceneCount, charCount, charWithRefCount, shotCount, project] = await Promise.all([
    db.scene.count({ where: { projectId } }),
    db.character.count({ where: { projectId } }),
    db.character.count({ where: { projectId, refImageUrl: { not: null } } }),
    db.shot.count({ where: { scene: { projectId } } }),
    db.project.findUnique({ where: { id: projectId }, select: { pipelineStage: true } }),
  ]);

  if (!project) return "IDLE";

  if (sceneCount === 0 && charCount === 0) return "ASSET_EXTRACTION";
  if (charCount > 0 && charWithRefCount < charCount) return "ASSET_GENERATION";
  if (sceneCount > 0 && shotCount === 0) return "STORYBOARDING";
  if (shotCount > 0) return "DONE";

  return (project.pipelineStage as PipelineStage) || "IDLE";
}

/**
 * 根据数据库中已有场次与角色，写入 ECP 分镜行（结构化 imagePrompt / videoPrompt）。
 * 由完整流水线在资产生成之后调用；也可在「仅重生提示词」流程中在清空 Shot 后单独调用。
 */
export async function runEcpStoryboardForProject(projectId: string): Promise<void> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const config = (project.modelConfig as Record<string, unknown> | null) ?? {};
  const textModel = (config.textModel as string) || env.DEFAULT_TEXT_MODEL;
  const narrativeStyle = (config.narrativeStyle as string) || "THIRD_PERSON";

  await db.project.update({
    where: { id: projectId },
    data: { pipelineStage: "STORYBOARDING" },
  });

  logger.info({ projectId }, "[director] ECP storyboard table start");

  // 先执行 screenplay 场景 → 剧本规范化 → JSON 剧本的多阶段流水线
  // （如果尚未完成）
  const hasNormalizedScenes = await db.scene.count({
    where: { projectId, scriptText: { contains: "。" } },
  }).then((n: number) => n > 0);

  if (!hasNormalizedScenes) {
    logger.info({ projectId }, "[director] running normalize-drama-script");
    await normalizeDramaScript(projectId, 1, textModel as TextModelKey);
    logger.info({ projectId }, "[director] running create-episode-script");
    await createEpisodeScript(projectId, 1, textModel as TextModelKey);
  }

  const scenes = await db.scene.findMany({
    where: { projectId },
    include: { props: true },
    orderBy: [{ episodeNumber: "asc" }, { order: "asc" }],
  });

  const characters = await db.character.findMany({
    where: { projectId },
  });

  if (scenes.length === 0) {
    throw new Error(
      project.language === "en"
        ? "No scenes in project; run script parse first."
        : "项目中没有场次，请先完成剧本解析或「重新解析剧本」。",
    );
  }

  const isEn = project.language === "en";

  // 2 分钟/集目标：120s ÷ 15s = 8 shots/集
  const SHOTS_PER_EPISODE = 8;

  // 按集分组场次数
  const episodeSceneCounts = new Map<number, number>();
  for (const s of scenes) {
    episodeSceneCounts.set(s.episodeNumber, (episodeSceneCounts.get(s.episodeNumber) ?? 0) + 1);
  }

  for (const [ep, count] of episodeSceneCounts) {
    if (count > 6) {
      logger.warn(
        { projectId, episodeNumber: ep, sceneCount: count },
        `[director] episode ${ep} has ${count} scenes > 6 — each scene gets < 2 shots`,
      );
    }
  }

  const episodeSceneIndex = new Map<number, number>();

  function targetShotsForScene(episodeNumber: number): number {
    const sceneCount = episodeSceneCounts.get(episodeNumber) ?? 1;
    const idx = episodeSceneIndex.get(episodeNumber) ?? 0;
    episodeSceneIndex.set(episodeNumber, idx + 1);
    const effectiveTotal = Math.max(SHOTS_PER_EPISODE, sceneCount);
    const base = Math.floor(effectiveTotal / sceneCount);
    const remainder = effectiveTotal % sceneCount;
    return Math.max(1, base + (idx < remainder ? 1 : 0));
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const prev = i > 0 ? scenes[i - 1]! : null;
    const continuityFromPriorScene = !prev
      ? undefined
      : prev.episodeNumber !== scene.episodeNumber
        ? isEn
          ? `Episode boundary: now episode ${scene.episodeNumber}. Previous episode has ended. Re-establish using ONLY the current scene script.`
          : `集间切换：当前为第 ${scene.episodeNumber} 集，上一集已结束。请仅依据本场次剧本重新建立时空。`
        : [
            prev.location !== scene.location ||
            (prev.timeOfDay ?? "") !== (scene.timeOfDay ?? "")
              ? isEn
                ? `Space/time: prior ${prev.location}${prev.timeOfDay ? ` · ${prev.timeOfDay}` : ""} → current ${scene.location}${scene.timeOfDay ? ` · ${scene.timeOfDay}` : ""}.`
                : `空间/时间：上一场 ${prev.location}${prev.timeOfDay ? ` · ${prev.timeOfDay}` : ""} → 本场 ${scene.location}${scene.timeOfDay ? ` · ${scene.timeOfDay}` : ""}。`
              : isEn
                ? `Same episode, consecutive scene order ${prev.order} → ${scene.order}.`
                : `同一集内连续场次：上一场序 ${prev.order} → 本场序 ${scene.order}。`,
            isEn
              ? `Prior scene closing beats (emotional through-line only; advance the story, do not replay):`
              : `上一场收束节拍（仅供情绪衔接，请推进故事，勿复述）：`,
            prev.scriptText.slice(-800),
          ].join("\n");

    const shots = await generateStoryboard({
      projectTitle: project.title,
      episodeNumber: scene.episodeNumber,
      continuityFromPriorScene,
      scene: {
        order: scene.order,
        location: scene.location,
        timeOfDay: scene.timeOfDay || undefined,
        scriptText: scene.scriptText,
        props: scene.props.map((p: { name: string }) => p.name),
      },
      characters: characters.map((c: { name: string; description: string | null; visualPrompt: string | null }) => ({
        name: c.name,
        description: c.description || "",
        visualPrompt: c.visualPrompt || undefined,
      })),
      model: textModel as any,
      narrativeStyle: narrativeStyle as "THIRD_PERSON" | "FIRST_PERSON",
      language: project.language,
      targetShotsForThisScene: targetShotsForScene(scene.episodeNumber),
    });

    await db.$transaction(async (tx: any) => {
      for (const shot of shots) {
        const createdShot = await tx.shot.create({
          data: {
            sceneId: scene.id,
            order: shot.shotOrder,
            type: shot.type,
            cameraMove: shot.cameraMove,
            prompt: filterSensitiveWords(shot.imagePrompt),
            imagePrompt: filterSensitiveWords(shot.imagePrompt),
            videoPrompt: filterSensitiveWords(shot.videoPrompt),
            duration: shot.duration ?? 15,
          },
        });

        if (shot.charactersInShot && shot.charactersInShot.length > 0) {
          const charIds = characters
            .filter((c: { name: string; id: string }) => shot.charactersInShot!.includes(c.name))
            .map((c: { id: string }) => c.id);

          if (charIds.length > 0) {
            await tx.shotCharacter.createMany({
              data: charIds.map((cid: string) => ({ shotId: createdShot.id, characterId: cid })),
            });
          }
        }
      }
    });
  }

  await db.project.update({
    where: { id: projectId },
    data: { pipelineStage: "DONE" },
  });

  logger.info({ projectId }, "[director] ECP storyboard table complete");
}

/**
 * 删除所有分镜行后仅重跑 ECP（不重新解析全文、不重画 MRI）。
 * 会清空成片相关字段；调用方应先取消 BullMQ 中与该项目相关的排队任务。
 * 若 LLM 中途失败，会再次清空分镜并写入 FAILED，避免留下半套镜头。
 *
 * 并发保护：若项目当前已处于 STORYBOARDING 阶段，说明已有实例在跑，直接返回避免重复。
 */
export async function regenerateStructuredPromptsOnly(projectId: string): Promise<void> {
  // 乐观锁：用 updateMany 原子地把状态从非 STORYBOARDING 切换到 STORYBOARDING。
  // 若已经是 STORYBOARDING（另一次并发调用先到），updateMany 匹配 0 行 → 直接退出。
  const lock = await db.project.updateMany({
    where: { id: projectId, pipelineStage: { not: "STORYBOARDING" } },
    data: { pipelineStage: "STORYBOARDING" },
  });
  if (lock.count === 0) {
    logger.warn({ projectId }, "[director] regenerateStructuredPromptsOnly already running — skipping duplicate");
    return;
  }

  await db.shot.deleteMany({ where: { scene: { projectId } } });
  try {
    await runEcpStoryboardForProject(projectId);
  } catch (err) {
    await db.shot.deleteMany({ where: { scene: { projectId } } });
    await db.project.update({
      where: { id: projectId },
      data: {
        status: "FAILED",
        pipelineStage: "IDLE",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
  await db.project.update({
    where: { id: projectId },
    data: {
      status: "DRAFT",
      pipelineStage: "IDLE",
      finalVideoUrl: null,
      episodeFinals: undefined,
      duration: null,
      completedAt: null,
      errorMessage: null,
    },
  });
  logger.info({ projectId }, "[director] structured prompts-only regenerate finished");
}

/**
 * Director: 多阶段流水线（参考 ArcReel 编排 Skill + 聚焦 Subagent 模式）。
 *
 * 阶段 0：ASSET_EXTRACTION — 从小说中提取角色/场景/道具定义（analyze-assets agent）
 * 阶段 1：PARSING — 小说→剧本解析（parser.agent）
 * 阶段 2：ASSET_GENERATION — 角色/场景/道具 MRI 参考图
 * 阶段 3：SCRIPT_NORMALIZATION — 场景剧本规范化（normalize-drama-script agent）
 * 阶段 4：EPISODE_SCRIPT — JSON 剧本生成（create-episode-script agent）
 * 阶段 5：STORYBOARDING — 分镜提示词表生成
 * 阶段 6：出片队列（BullMQ shot worker）— 关键帧 + Seedance 视频 + 合成
 *
 * 自动断点续传：detectCurrentStage() 通过数据库记录判断当前阶段
 */
export async function runParseAndStoryboard(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const currentStage = await detectCurrentStage(projectId);

  // 已有 shots → 只需 fanout，不重跑
  if (currentStage === "DONE") {
    const hasShots = await db.shot.count({ where: { scene: { projectId } } }).then((n: number) => n > 0);
    if (hasShots) {
      logger.info({ projectId }, "[director] shots already exist — skip to fanout");
      const { fanoutAssetsAndCompose } = await import("@/lib/queue/flows");
      await fanoutAssetsAndCompose(projectId);
      return;
    }
  }

  try {
    const config = (project.modelConfig as Record<string, unknown>) || {};
    const textModel = (config.textModel as string) || env.DEFAULT_TEXT_MODEL;
    const imageModel = (config.imageModel as string) || env.DEFAULT_IMAGE_MODEL;
    const inputType = (config.inputType as string) || "SCRIPT";
    const narrativeStyle = (config.narrativeStyle as string) || "THIRD_PERSON";

    // ----- Stage 0: ASSET EXTRACTION (ArcReel-inspired: separate character/scene/prop analysis) -----
    if (currentStage === "ASSET_EXTRACTION" || currentStage === "IDLE") {
      await db.project.update({
        where: { id: projectId },
        data: { pipelineStage: "ASSET_EXTRACTION", status: "GENERATING" },
      });

      const charCount = await db.character.count({ where: { projectId } });
      if (charCount === 0) {
        logger.info({ projectId }, "[director] asset extraction start (ArcReel multi-stage)");
        await analyzeAssets(projectId, textModel as TextModelKey);
      }
    }

    // ----- Stage 1: PARSING (novel → scenes + characters) -----
    const sceneCount = await db.scene.count({ where: { projectId } });
    if (sceneCount === 0) {
      await db.project.update({
        where: { id: projectId },
        data: { pipelineStage: "PARSING", status: "GENERATING", startedAt: new Date(), errorMessage: null },
      });

      logger.info({ projectId }, "[director] parse start");

      const parsed = await parseScript(
        project.rawScript,
        project.episodeCount,
        project.language,
        textModel,
        inputType as "SCRIPT" | "NOVEL",
        narrativeStyle as "THIRD_PERSON" | "FIRST_PERSON",
      );

      if (!parsed.scenes?.length) {
        throw new Error(
          "解析结果为空：未识别到任何场次。请加长剧本内容、检查格式，或降低分集数后重试。",
        );
      }

    await db.$transaction(async (tx: any) => {
        await tx.scene.deleteMany({ where: { projectId } });
        await tx.character.deleteMany({ where: { projectId } });

        for (const scene of parsed.scenes) {
          await tx.scene.create({
            data: {
              projectId,
              episodeNumber: scene.episodeNumber || 1,
              order: scene.order,
              location: filterSensitiveWords(scene.location),
              timeOfDay: scene.timeOfDay,
              scriptText: filterSensitiveWords(scene.scriptText),
              props: {
                create: scene.props.map((name: string) => ({
                  name: filterSensitiveWords(name),
                })),
              },
            },
          });
        }

        for (const c of parsed.characters) {
          await tx.character.create({
            data: {
              projectId,
              name: filterSensitiveWords(c.name),
              description: filterSensitiveWords(c.description),
              personality: c.personality,
              background: c.background,
              visualPrompt: c.visualPrompt,
            },
          });
        }
      });
    }

    // ----- Stage 2: ASSET GENERATION (character/scene/prop reference images) -----
    const charsNeedingRef = await db.character.count({ where: { projectId, refImageUrl: null } });
    if (charsNeedingRef > 0) {
      await db.project.update({
        where: { id: projectId },
        data: { pipelineStage: "ASSET_GENERATION" },
      });

      logger.info({ projectId, count: charsNeedingRef }, "[director] asset anchoring start");

      const chars = await db.character.findMany({ where: { projectId, refImageUrl: null } });
      const imageConc = env.PIPELINE_IMAGE_CONCURRENCY;

      if (chars.length > 0) {
        await runPool(chars, imageConc, async (char: { id: string }) => {
          try { await generateCharacterReference(char.id, imageModel); }
          catch (err) { logger.error({ charId: char.id, err }, "[director] character asset failed"); }
        });
      }

      await resubmitFailedCharacterAudits(projectId);
      await waitForCharacterAudits(projectId);

      const scenes = await db.scene.findMany({
        where: { projectId },
        include: { props: true },
      });

      const sceneTasks = scenes.filter((s: { refImageUrl: string | null }) => !s.refImageUrl);
      if (sceneTasks.length > 0) {
        await runPool(sceneTasks, imageConc, async (s: { id: string }) => {
          try { await generateSceneReference(s.id, imageModel); }
          catch (err) { logger.error({ sceneId: s.id, err }, "[director] scene asset failed"); }
        });
      }

      const propTasks = scenes.flatMap(
        (s: { props: { refImageUrl: string | null; id: string }[] }) => s.props.filter((p: { refImageUrl: string | null }) => !p.refImageUrl),
      );
      for (const prop of propTasks) {
        generatePropReference(prop.id, imageModel).catch((err: any) =>
          logger.warn({ propId: prop.id, err }, "[director] prop ref failed"),
        );
      }
    }

    // ----- Stage 3: SCRIPT NORMALIZATION (normalize-drama-script + create-episode-script) -----
    // 在 runEcpStoryboardForProject 内部自动触发

    // ----- Stage 4: STORYBOARDING (ECP 表) -----
    await runEcpStoryboardForProject(projectId);

    logger.info({ projectId }, "[director] pipeline setup complete");

  } catch (error: any) {
    logger.error({ projectId, error }, "[director] pipeline failed");
    await db.project.update({
      where: { id: projectId },
      data: { status: "FAILED", errorMessage: error.message, pipelineStage: "IDLE" },
    });
    throw error;
  }
}
