import { Worker } from "bullmq";
import { z } from "zod";
import { createBullConnection } from "@/lib/queue/connection";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { composeFinalVideo } from "@/lib/orchestrator/composer.agent";

const PayloadSchema = z.object({ projectId: z.string() });

export type EpisodeFinalPayload = {
  episodeNumber: number;
  videoUrl: string;
  durationSec: number;
};

/**
 * Root job of the BullMQ flow. After all per-shot children finish, stitches
 * **one master MP4 per episode (集)** from shot `videoUrl`s in DB order, then stores
 * them in `Project.episodeFinals`. `finalVideoUrl` points at episode 1 for legacy UI.
 */
export const composeWorker = new Worker(
  "compose",
  async (job) => {
    const { projectId } = PayloadSchema.parse(job.data);
    const log = logger.child({ projectId, jobId: job.id });
    log.info("[compose-worker] start");

    await db.project.update({
      where: { id: projectId },
      data: { pipelineStage: "COMPOSING" },
    });

    const shots = await db.shot.findMany({
      where: { scene: { projectId }, videoUrl: { not: null } },
      orderBy: [
        { scene: { episodeNumber: "asc" } },
        { scene: { order: "asc" } },
        { order: "asc" },
      ],
      select: { videoUrl: true, imageUrl: true, scene: { select: { episodeNumber: true } } },
    });

    if (shots.length === 0) {
      throw new Error("No completed shots to compose");
    }

    const byEp = new Map<number, string[]>();
    for (const s of shots) {
      const ep = s.scene.episodeNumber;
      if (!byEp.has(ep)) byEp.set(ep, []);
      if (s.videoUrl) byEp.get(ep)!.push(s.videoUrl);
    }

    const sortedEps = [...byEp.keys()].sort((a, b) => a - b);
    const episodeFinals: EpisodeFinalPayload[] = [];

    for (const ep of sortedEps) {
      const urls = byEp.get(ep)!;
      if (urls.length === 0) continue;
      const r = await composeFinalVideo({
        projectId,
        episodeNumber: ep,
        shotVideoUrls: urls,
      });
      episodeFinals.push({
        episodeNumber: ep,
        videoUrl: r.videoUrl,
        durationSec: r.durationSec,
      });
    }

    if (episodeFinals.length === 0) {
      throw new Error("Episode composition produced no outputs");
    }

    const totalDuration = episodeFinals.reduce((acc, e) => acc + e.durationSec, 0);
    const primaryUrl = episodeFinals[0]!.videoUrl;

    await db.project.update({
      where: { id: projectId },
      data: {
        status: "COMPLETED",
        pipelineStage: "DONE",
        finalVideoUrl: primaryUrl,
        episodeFinals: episodeFinals as object[],
        duration: totalDuration,
        thumbnailUrl: shots[0]?.imageUrl ?? null,
        completedAt: new Date(),
      },
    });

    log.info({ episodeCount: episodeFinals.length, totalDuration }, "[compose-worker] done");
    return { episodeFinals, primaryUrl, totalDuration };
  },
  { connection: createBullConnection(), concurrency: 2 },
);

composeWorker.on("failed", async (job, err) => {
  logger.error({ jobId: job?.id, err }, "[compose-worker] failed");
  if (job?.data && typeof job.data === "object" && "projectId" in job.data) {
    await db.project.update({
      where: { id: String((job.data as { projectId: string }).projectId) },
      data: { status: "FAILED", errorMessage: err.message, pipelineStage: "IDLE" },
    });
  }
});
