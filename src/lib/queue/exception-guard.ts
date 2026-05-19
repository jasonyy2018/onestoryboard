import { logger } from "@/lib/logger";

function isBullMqAbortNoise(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return (
    e.code === "ERR_INVALID_STATE" &&
    typeof e.message === "string" &&
    (e.message as string).includes("Controller is already closed")
  );
}

// --- 1. Patch AbortController so abort() never throws "Controller is already closed" ---
// BullMQ 5.76.8 triggers this on Node.js 22 when a timeout controller is aborted twice.
const origAbort = AbortController.prototype.abort;
AbortController.prototype.abort = function patchedAbort(...args: Parameters<typeof origAbort>) {
  try {
    origAbort.apply(this, args);
  } catch (err: unknown) {
    if (isBullMqAbortNoise(err)) {
      return;
    }
    throw err;
  }
};

// --- 2. Process-level guard (prependListener ensures we run before any other handler) ---
process.prependListener("uncaughtException", (err) => {
  if (isBullMqAbortNoise(err)) {
    return;
  }
  logger.error({ err }, "[exception-guard] uncaughtException");
});

process.prependListener("unhandledRejection", (err) => {
  if (isBullMqAbortNoise(err)) return;
  logger.error({ err }, "[exception-guard] unhandledRejection");
});
