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

function isBullMQAbortNoise(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    (err as any).code === "ERR_INVALID_STATE" &&
    err.message.includes("Controller is already closed")
  );
}

process.on("uncaughtException", (err) => {
  // BullMQ 5.x internal AbortController double-abort — safe to ignore
  if (isBullMQAbortNoise(err)) return;
  logger.error({ err }, "[worker] uncaughtException — keeping process alive");
});

process.on("unhandledRejection", (err) => {
  if (isBullMQAbortNoise(err)) return;
  logger.error({ err }, "[worker] unhandledRejection — keeping process alive");
});

async function shutdown() {
  logger.info("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
