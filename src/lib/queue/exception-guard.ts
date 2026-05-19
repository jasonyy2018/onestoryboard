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
      // swallow — harmless race in BullMQ worker timeout lifecycle
      return;
    }
    throw err;
  }
};

// --- 2. Process-level guard (belt-and-suspenders) ---
process.on("uncaughtException", (err) => {
  // BullMQ × Node.js 22 竞态噪声：已由 AbortController 补丁处理，
  // 但仍可能通过微任务/异步路径逃逸。直接静默，不在控制台输出。
  if (isBullMqAbortNoise(err)) {
    // harmless BullMQ × Node 22 race — no action needed
    return;
  }
  logger.error({ err }, "[exception-guard] uncaughtException");
});

process.on("unhandledRejection", (err) => {
  if (isBullMqAbortNoise(err)) return;
  logger.error({ err }, "[exception-guard] unhandledRejection");
});
