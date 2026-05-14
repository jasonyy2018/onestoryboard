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

      await invokeShortDramaPipeline(projectId);
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
    // parse + 资产生成最长可达 20 分钟（腾讯 OG 轮询 + Volcengine 审核）
    // lockDuration: worker 持锁时间（ms），超过则被判定 stalled
    // stalledInterval: 检查 stalled 的间隔（ms）
    lockDuration: 30 * 60 * 1000,   // 30 分钟
    stalledInterval: 60 * 1000,      // 每 60 秒检查一次
    maxStalledCount: 1,              // 最多重试 1 次 stalled
  },
);

parseWorker.on("failed", (job, err) =>
  logger.error({ jobId: job?.id, err }, "[parse-worker] failed"),
);
