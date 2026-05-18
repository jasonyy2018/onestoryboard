import { logger } from "@/lib/logger";

// --- 1. Patch AbortController so abort() never throws "Controller is already closed" ---
// BullMQ 5.76.8 triggers this on Node.js 22 when a timeout controller is aborted twice.
const origAbort = AbortController.prototype.abort;
AbortController.prototype.abort = function patchedAbort(...args: Parameters<typeof origAbort>) {
  try {
    origAbort.apply(this, args);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      (err as Record<string, unknown>).code === "ERR_INVALID_STATE" &&
      typeof (err as Error).message === "string" &&
      (err as Error).message.includes("Controller is already closed")
    ) {
      // swallow — harmless race in BullMQ worker timeout lifecycle
      return;
    }
    throw err;
  }
};

// --- 2. Process-level guard (belt-and-suspenders) ---
process.on("uncaughtException", (err) => {
  if (
    err &&
    typeof err === "object" &&
    (err as Record<string, unknown>).code === "ERR_INVALID_STATE" &&
    typeof (err as Error).message === "string" &&
    (err as Error).message.includes("Controller is already closed")
  ) {
    return;
  }
  logger.error({ err }, "[exception-guard] uncaughtException");
});

process.on("unhandledRejection", (err) => {
  if (
    err &&
    typeof err === "object" &&
    (err as Record<string, unknown>).code === "ERR_INVALID_STATE" &&
    typeof (err as Error).message === "string" &&
    (err as Error).message.includes("Controller is already closed")
  ) {
    return;
  }
  logger.error({ err }, "[exception-guard] unhandledRejection");
});
