import { logger } from "@/lib/logger";

function isBullMQAbortNoise(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return (
    e.code === "ERR_INVALID_STATE" &&
    typeof e.message === "string" &&
    (e.message as string).includes("Controller is already closed")
  );
}

process.on("uncaughtException", (err) => {
  if (isBullMQAbortNoise(err)) return;
  logger.error({ err }, "[exception-guard] uncaughtException");
});

process.on("unhandledRejection", (err) => {
  if (isBullMQAbortNoise(err)) return;
  logger.error({ err }, "[exception-guard] unhandledRejection");
});
