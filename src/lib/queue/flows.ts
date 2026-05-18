import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { flowProducer, QUEUE_NAMES, queues } from "./queues";

/**
 * Entry point invoked by /api/projects/[id]/generate.
 * Creates the parent flow which, on completion, fans out per-shot jobs.
 */
export async function dispatchPipeline(projectId: string) {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      scenes: {
        orderBy: [{ episodeNumber: "asc" }, { order: "asc" }],
        include: { shots: { orderBy: { order: "asc" } } },
      },
    },
  });

  // Stage 1+2: parsing + storyboard run inline first (cheap, must finish before fanout).
  // The /api/generate route handler triggers the parse job below; once parse worker
  // finishes, it inserts shots and queues a child compose flow.

  const hasShots = project.scenes.flatMap((s) => s.shots).length > 0;

  // Any state with zero shots must run parse+storyboard first. Previously we skipped parse
  // when pipelineStage was e.g. STORYBOARDING/ASSET_GENERATION after a failed run, which
  // incorrectly fan-out 0 shot jobs and left the project stuck "generating".
  if (!hasShots) {
    const jobId = `parse-${projectId}`;
    logger.info({ projectId, jobId }, "[dispatchPipeline] enqueue parse-and-storyboard");

    // Remove stale failed parse job so retry isn't silently blocked by jobId dedup
    await queues.parse.remove(jobId).catch(() => {});

    await flowProducer.add({
      name: "parse-and-storyboard",
      queueName: QUEUE_NAMES.parse,
      data: { projectId },
      opts: {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    });
    return;
  }

  // Otherwise fan-out: parse already done, (re)generate shot videos + compose.
  await fanoutAssetsAndCompose(projectId);
}

/**
 * Build a flow tree:
 *   compose (root)
 *     ├─ shot 1.1
 *     ├─ shot 1.2
 *     ├─ ... (parallel)
 *
 * Already-completed shots (status=READY, videoUrl set) are skipped by the worker itself.
 * To allow re-queuing of failed/stalled shots we remove any stale BullMQ job entries
 * whose DB status is not READY before adding the new flow.
 */
export async function fanoutAssetsAndCompose(projectId: string) {
  const shots = await db.shot.findMany({
    where: { scene: { projectId } },
    include: { scene: true, characters: { include: { character: true } } },
    orderBy: [
      { scene: { episodeNumber: "asc" } },
      { scene: { order: "asc" } },
      { order: "asc" },
    ],
  });

  if (shots.length === 0) {
    logger.error({ projectId }, "[fanoutAssetsAndCompose] no shots — refusing empty compose flow");
    throw new Error(
      "No shots in database; parse/storyboard did not complete. Re-run generation from the editor or check workers/logs.",
    );
  }

  // Clear stale BullMQ job entries for shots that are not yet READY so that
  // BullMQ's dedup-by-jobId does not silently skip them on re-run.
  const incompleteShotIds = shots
    .filter((s) => !(s.status === "READY" && s.videoUrl))
    .map((s) => s.id);

  await Promise.all([
    ...incompleteShotIds.map((id) => queues.shot.remove(`shot-${id}`).catch(() => {})),
    queues.compose.remove(`compose-${projectId}`).catch(() => {}),
  ]);

  logger.info(
    { projectId, total: shots.length, requeue: incompleteShotIds.length },
    "[fanoutAssetsAndCompose] cleared stale jobs, building flow",
  );

  const shotChildren = shots.map((shot) => ({
    name: `shot-${shot.id}`,
    queueName: QUEUE_NAMES.shot,
    data: { shotId: shot.id, projectId },
    opts: {
      jobId: `shot-${shot.id}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  }));

  const children: any[] = [...shotChildren];

  await flowProducer.add({
    name: `compose-${projectId}`,
    queueName: QUEUE_NAMES.compose,
    data: { projectId },
      opts: { 
        jobId: `compose-${projectId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 1000
      },
    children,
  });
}

/**
 * Remove all pending jobs for a project from BullMQ queues.
 */
export async function cancelProjectJobs(projectId: string) {
  const shots = await db.shot.findMany({
    where: { scene: { projectId } },
    select: { id: true },
  });

  for (const shot of shots) {
    await queues.shot.remove(`shot-${shot.id}`).catch(() => {});
  }

  const characters = await db.character.findMany({
    where: { projectId },
    select: { id: true },
  });
  for (const c of characters) {
    await queues.asset.remove(`poll-${c.id}`).catch(() => {});
  }

  await queues.parse.remove(`parse-${projectId}`).catch(() => {});
  await queues.compose.remove(`compose-${projectId}`).catch(() => {});
}
