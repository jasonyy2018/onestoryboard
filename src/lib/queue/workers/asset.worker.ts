import { Worker } from "bullmq";
import { z } from "zod";
import { createBullConnection } from "@/lib/queue/connection";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { pollAssetStatus } from "@/lib/ai/volcengine-assets";

const PayloadSchema = z.object({
  assetId: z.string(),
  characterId: z.string().optional(),
  sceneId: z.string().optional(),
  propId: z.string().optional(),
  projectId: z.string(),
});

/**
 * Worker to poll Volcengine Asset Library for "Active" status.
 * Re-enqueues itself via BullMQ backoff if still processing.
 */
export const assetWorker = new Worker(
  "asset",
  async (job) => {
    const { assetId, characterId, sceneId, propId, projectId } = PayloadSchema.parse(job.data);
    const log = logger.child({ assetId, projectId });
    
    log.info("[asset-worker] polling status...");
    const status = await pollAssetStatus(assetId);
    log.info({ status }, "[asset-worker] status result");

    if (status === "Active") {
      const data = { volcengineStatus: "Active" };
      if (characterId) await db.character.update({ where: { id: characterId }, data });
      if (sceneId) await db.scene.update({ where: { id: sceneId }, data });
      if (propId) await db.prop.update({ where: { id: propId }, data });
      return { status: "Active" };
    }

    if (status === "Failed") {
      const data = { volcengineStatus: "Failed" };
      if (characterId) await db.character.update({ where: { id: characterId }, data });
      if (sceneId) await db.scene.update({ where: { id: sceneId }, data });
      if (propId) await db.prop.update({ where: { id: propId }, data });
      throw new Error(`Volcengine Asset Audit Failed for ${assetId}`);
    }

    // Still processing: Throwing will trigger BullMQ backoff/retry
    throw new Error("Asset still processing...");
  },
  {
    connection: createBullConnection(),
    concurrency: 5,
  }
);
