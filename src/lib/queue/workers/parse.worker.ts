import { Worker, Job } from "bullmq";
import { z } from "zod";
import { createBullConnection } from "@/lib/queue/connection";
import { invokeShortDramaPipeline } from "@/lib/langgraph";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";

const PayloadSchema = z.object({ projectId: z.string() });

const EXTEND_LOCK_EVERY_MS = 5 * 60 * 1000; // extend lock every 5 min

export const parseWorker = new Worker(
  "parse",
  async (job) => {
    const { projectId } = PayloadSchema.parse(job.data);
    const log = logger.child({ projectId, jobId: job.id });
    log.info("[parse-worker] start");

    // Periodic lock extension — parse can run 30+ min with multiple LLM calls
    const extendTimer = setInterval(async () => {
      try {
        await job.extendLock(job.token ?? "", 120 * 60 * 1000);
      } catch {
        // lock already released or job completed — ignore
      }
    }, EXTEND_LOCK_EVERY_MS);

    try {
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (project?.status === "CANCELLED" || project?.status === "PAUSED") {
        throw new Error(
          `PAUSED_SKIP: Parse not started while project status is ${project.status}.`,
        );
      }

      if (project?.seriesId) {
        const { runSeriesEpisodePipeline } = await import("@/lib/orchestrator/series");
        await runSeriesEpisodePipeline(projectId);
      } else {
        await invokeShortDramaPipeline(projectId);
      }

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.startsWith("PAUSED_SKIP:")) {
        await db.project.update({
          where: { id: projectId },
          data: {
            status: "FAILED",
            errorMessage: msg,
            pipelineStage: "IDLE",
          },
        });
      }
      throw err;
    } finally {
      clearInterval(extendTimer);
    }
  },
  {
    connection: createBullConnection(),
    concurrency: 4,
    lockDuration: 30 * 60 * 1000,
    stalledInterval: 2 * 60 * 1000,
    maxStalledCount: 2,
  },
);

parseWorker.on("failed", (job, err) =>
  logger.error({ jobId: job?.id, err }, "[parse-worker] failed"),
);
