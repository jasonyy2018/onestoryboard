/**
 * Worker entrypoint — runs in its own Node process (`pnpm start:worker`).
 * Imports each worker so they auto-register with BullMQ.
 */
import "dotenv/config";
import { logger } from "@/lib/logger";
import { parseWorker } from "./parse.worker";
import { shotWorker } from "./shot.worker";
import { composeWorker } from "./compose.worker";
import { assetWorker } from "./asset.worker";

const workers = [parseWorker, shotWorker, composeWorker, assetWorker];

logger.info(
  { workers: workers.map((w) => w.name) },
  "Onestoryboard workers online",
);

async function shutdown() {
  logger.info("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
