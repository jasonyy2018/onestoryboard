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

  // 警告：场次过多时每场分到的 Shot 会不足
  for (const [ep, count] of episodeSceneCounts) {
    if (count > 6) {
      logger.warn(
        { projectId, episodeNumber: ep, sceneCount: count },
        `[director] episode ${ep} has ${count} scenes > 6 — each scene gets < 2 shots, story may be fragmented. Parser should have merged scenes.`,
      );
    }
    if (count > SHOTS_PER_EPISODE) {
      logger.error(
        { projectId, episodeNumber: ep, sceneCount: count },
        `[director] episode ${ep} has ${count} scenes > ${SHOTS_PER_EPISODE} shots target — some scenes will get 0 shots allocated.`,
      );
    }
  }

  // 每集场次内按场次索引分配 Shot 数（至少保证每场 1 个）
  const episodeSceneIndex = new Map<number, number>();

  function targetShotsForScene(episodeNumber: number): number {
    const sceneCount = episodeSceneCounts.get(episodeNumber) ?? 1;
    const idx = episodeSceneIndex.get(episodeNumber) ?? 0;
    episodeSceneIndex.set(episodeNumber, idx + 1);
    // 最少保证每场 1 个 Shot
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
          ? `Episode boundary: now episode ${scene.episodeNumber}. Previous episode has ended. Re-establish using ONLY the current scene script; do not invent events not implied by this text.`
          : `集间切换：当前为第 ${scene.episodeNumber} 集，上一集已结束。请仅依据本场次剧本重新建立时空与情境，不要编造正文未暗示的情节。`
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
        props: scene.props.map((p) => p.name),
      },
      characters: characters.map((c) => ({
        name: c.name,
        description: c.description || "",
        visualPrompt: c.visualPrompt || undefined,
      })),
      model: textModel as any,
      narrativeStyle: narrativeStyle as "THIRD_PERSON" | "FIRST_PERSON",
      language: project.language,
      targetShotsForThisScene: targetShotsForScene(scene.episodeNumber),
    });

    await db.$transaction(async (tx) => {
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
            .filter((c) => shot.charactersInShot!.includes(c.name))
            .map((c) => c.id);

          if (charIds.length > 0) {
            await tx.shotCharacter.createMany({
              data: charIds.map((cid) => ({ shotId: createdShot.id, characterId: cid })),
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
 * Director: 与制片步骤一致的多段流水线。
 * 1. 导入小说或剧本 → 解析（小说在此阶段转为标准剧本与场次结构）。
 * 2. 资产生成 — 角色·场景·道具 MRI 参考图（画风与后续生图/生视频锚点；默认与全站一致用腾讯混元生图 OG，见 env.DEFAULT_IMAGE_MODEL / project.modelConfig.imageModel）。
 * 3. ECP — 按场次生成分镜「结构化提示词」表（imagePrompt / videoPrompt 等写入 Shot）。
 * 4. 出片队列（BullMQ shot 任务）— 每镜：imagePrompt + Part1 模板 → 多格真人制片板图入库；再以 videoPrompt + Part2 模板，以「制片板图为首张参考图 + MRI」调用 Seedance 2.0 生成约 15s 视频（含原生音频）；最后 compose 按「集」将本集全部镜头合成一条集成片（多集则多条，见 Project.episodeFinals）。
 */
export async function runParseAndStoryboard(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });

  // ── 断点续传：根据已完成的阶段决定从哪步继续 ──────────────────────────
  const resumeStage = project.pipelineStage;
  const hasScenes = await db.scene.count({ where: { projectId } }).then(n => n > 0);
  const hasShots  = await db.shot.count({ where: { scene: { projectId } } }).then(n => n > 0);

  // 已有 shots → 只需 fanout，不重跑 parse/asset/storyboard
  if (hasShots) {
    logger.info({ projectId, resumeStage }, "[director] shots already exist — skip to fanout");
    const { fanoutAssetsAndCompose } = await import("@/lib/queue/flows");
    await fanoutAssetsAndCompose(projectId);
    return;
  }

  // 已完成 storyboard（有场次但无 shots）→ 直接重跑 storyboard 生成 shots
  if (hasScenes && (resumeStage === "STORYBOARDING" || resumeStage === "DONE")) {
    logger.info({ projectId, resumeStage }, "[director] scenes exist, re-run ECP storyboard only");
    await runEcpStoryboardForProject(projectId);
    const { fanoutAssetsAndCompose } = await import("@/lib/queue/flows");
    await fanoutAssetsAndCompose(projectId);
    return;
  }

  // 已有场次且处于 ASSET_GENERATION → 跳过 parse，继续资产生成+storyboard
  const skipParse = hasScenes && (
    resumeStage === "ASSET_GENERATION" ||
    resumeStage === "STORYBOARDING"
  );

  try {
    const config = (project.modelConfig as any) || {};

    // ----- Stage 1: PARSING -----
    if (skipParse) {
      logger.info({ projectId, resumeStage }, "[director] skipping parse — scenes already exist");
    } else {
      await db.project.update({
        where: { id: projectId },
        data: {
          pipelineStage: "PARSING",
          status: "GENERATING",
          startedAt: new Date(),
          errorMessage: null
        },
      });

    logger.info({ projectId }, "[director] parse start");
    const textModel = config.textModel || env.DEFAULT_TEXT_MODEL;
    const inputType = config.inputType || "SCRIPT";
    const narrativeStyle = config.narrativeStyle || "THIRD_PERSON";
    
    // Preserve ref images across re-parse; only characters use Volcengine audit IDs.
    type CharVolcAssets = {
      refImageUrl: string | null;
      volcengineAssetId: string | null;
      volcengineStatus: string | null;
    };
    type SceneBundle = {
      refImageUrl: string | null;
      props: Map<string, { refImageUrl: string | null }>;
    };

    const existingScenes = await db.scene.findMany({
      where: { projectId },
      include: { props: true },
      orderBy: [{ episodeNumber: "asc" }, { order: "asc" }],
    });
    const existingCharacters = await db.character.findMany({ where: { projectId } });

    const sceneByEpisodeOrder = new Map<string, SceneBundle>();
    const sceneByLocation = new Map<string, SceneBundle>();

    for (const s of existingScenes) {
      const bundle: SceneBundle = {
        refImageUrl: s.refImageUrl,
        props: new Map(
          s.props.map((p) => [
            p.name,
            { refImageUrl: p.refImageUrl },
          ]),
        ),
      };
      sceneByEpisodeOrder.set(`${s.episodeNumber}:${s.order}`, bundle);
      sceneByLocation.set(s.location, bundle);
    }

    const charAssetsByName = new Map<string, CharVolcAssets>();
    for (const c of existingCharacters) {
      const assets: CharVolcAssets = {
        refImageUrl: c.refImageUrl,
        volcengineAssetId: c.volcengineAssetId,
        volcengineStatus: c.volcengineStatus,
      };
      charAssetsByName.set(c.name, assets);
      const filtered = filterSensitiveWords(c.name);
      if (filtered !== c.name) charAssetsByName.set(filtered, assets);
    }

    const parsed = await parseScript(
      project.rawScript, 
      project.episodeCount, 
      project.language, 
      textModel, 
      inputType, 
      narrativeStyle
    );

    if (!parsed.scenes?.length) {
      throw new Error(
        "解析结果为空：未识别到任何场次。请加长剧本内容、检查格式，或降低分集数后重试。",
      );
    }

    // Persist scenes + characters atomically.
    await db.$transaction(async (tx) => {
      await tx.scene.deleteMany({ where: { projectId } });
      await tx.character.deleteMany({ where: { projectId } });

      for (const scene of parsed.scenes) {
        const episodeNumber = scene.episodeNumber || 1;
        const locationStored = filterSensitiveWords(scene.location);
        const fromOrder = sceneByEpisodeOrder.get(`${episodeNumber}:${scene.order}`);
        const fromLocation =
          sceneByLocation.get(locationStored) ?? sceneByLocation.get(scene.location);
        const preserved = fromOrder ?? fromLocation;

        await tx.scene.create({
          data: {
            projectId,
            episodeNumber,
            order: scene.order,
            location: locationStored,
            timeOfDay: scene.timeOfDay,
            scriptText: filterSensitiveWords(scene.scriptText),
            refImageUrl: preserved?.refImageUrl ?? null,
            volcengineAssetId: null,
            volcengineStatus: null,
            props: {
              create: scene.props.map((name) => {
                const propName = filterSensitiveWords(name);
                const propPersisted =
                  preserved?.props.get(name) ??
                  preserved?.props.get(propName) ??
                  null;
                return {
                  name: propName,
                  refImageUrl: propPersisted?.refImageUrl ?? null,
                  volcengineAssetId: null,
                  volcengineStatus: null,
                };
              }),
            },
          },
        });
      }

      for (const c of parsed.characters) {
        const nameStored = filterSensitiveWords(c.name);
        const persistedChar =
          charAssetsByName.get(c.name) ??
          charAssetsByName.get(nameStored) ??
          null;
        await tx.character.create({
          data: { 
            projectId, 
            name: nameStored, 
            description: filterSensitiveWords(c.description),
            personality: c.personality,
            background: c.background,
            visualPrompt: c.visualPrompt,
            refImageUrl: persistedChar?.refImageUrl ?? null,
            volcengineAssetId: persistedChar?.volcengineAssetId ?? null,
            volcengineStatus: persistedChar?.volcengineStatus ?? null,
          },
        });
      }
    });
    } // end if (!skipParse)

    // ----- Stage 2: ASSET GENERATION -----
    // We do this BEFORE storyboarding so shots can reference these assets.
    await db.project.update({
      where: { id: projectId },
      data: { pipelineStage: "ASSET_GENERATION" },
    });

    logger.info({ projectId }, "[director] asset anchoring start");
    
    const projectWithAssets = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { characters: true, scenes: { include: { props: true } } }
    });

    const imageConc = env.PIPELINE_IMAGE_CONCURRENCY;

    const charsNeedingRef = projectWithAssets.characters.filter((c) => !c.refImageUrl);
    if (charsNeedingRef.length > 0) {
      logger.info({ projectId, count: charsNeedingRef.length, imageConc }, "[director] character refs (parallel)");
      await runPool(charsNeedingRef, imageConc, async (char) => {
        try {
          await generateCharacterReference(char.id, config.imageModel);
        } catch (err) {
          logger.error({ charId: char.id, err }, "[director] character asset failed");
        }
      });
    }

    // Re-submit any characters whose Volcengine audit is missing or previously failed,
    // then block until every character reaches Active (or Failed) before storyboarding.
    await resubmitFailedCharacterAudits(projectId);
    await waitForCharacterAudits(projectId);

    type ScenePropTask =
      | { kind: "scene"; id: string }
      | { kind: "prop"; id: string };

    const scenePropTasks: ScenePropTask[] = [];
    for (const scene of projectWithAssets.scenes) {
      if (!scene.refImageUrl) scenePropTasks.push({ kind: "scene", id: scene.id });
      for (const prop of scene.props) {
        if (!prop.refImageUrl) scenePropTasks.push({ kind: "prop", id: prop.id });
      }
    }
    // 场景图：等待完成（场景是故事板生图的关键参考，值得等）
    // 道具图：fire-and-forget（道具参考可选，不阻塞主流程）
    const sceneTasks = scenePropTasks.filter(t => t.kind === "scene");
    const propTasks  = scenePropTasks.filter(t => t.kind === "prop");

    if (sceneTasks.length > 0) {
      logger.info({ projectId, count: sceneTasks.length, imageConc }, "[director] scene refs (parallel, awaited)");
      await runPool(sceneTasks, imageConc, async (t) => {
        try {
          await generateSceneReference(t.id, config.imageModel);
        } catch (err) {
          logger.error({ task: t, err }, "[director] scene asset failed");
        }
      });
    }

    if (propTasks.length > 0) {
      logger.info({ projectId, count: propTasks.length }, "[director] prop refs (fire-and-forget, not blocking storyboard)");
      // 不 await — 道具图在后台生成，shot.worker 用到时取已有的
      void runPool(propTasks, imageConc, async (t) => {
        try {
          await generatePropReference(t.id, config.imageModel);
        } catch (err) {
          logger.error({ task: t, err }, "[director] prop asset failed (non-blocking)");
        }
      });
    }

    // ----- Stage 3: STORYBOARDING (ECP 表) -----
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
