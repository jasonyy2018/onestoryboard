import { Worker } from "bullmq";
import { z } from "zod";
import { createBullConnection } from "@/lib/queue/connection";
import { invokeShortDramaPipeline } from "@/lib/langgraph";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";

const PayloadSchema = z.object({ projectId: z.string() });

export const parseWorker = new Worker(
  "parse",
  async (job) => {
    const { projectId } = PayloadSchema.parse(job.data);
    logger.info({ projectId, jobId: job.id }, "[parse-worker] start");

    try {
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (project?.status === "CANCELLED" || project?.status === "PAUSED") {
        throw new Error(
          `PAUSED_SKIP: Parse not started while project status is ${project.status}.`,
        );
      }

      if (project?.seriesId) {
        // Series 项目：走角色池复用流水线
        const { runSeriesEpisodePipeline } = await import("@/lib/orchestrator/series");
        await runSeriesEpisodePipeline(projectId);
      } else {
        // 独立单集项目：走原有流水线
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
    }
  },
  {
    connection: createBullConnection(),
    concurrency: 4,
    lockDuration: 30 * 60 * 1000,
    stalledInterval: 60 * 1000,
    maxStalledCount: 1,
  },
);

parseWorker.on("failed", (job, err) =>
  logger.error({ jobId: job?.id, err }, "[parse-worker] failed"),
);
