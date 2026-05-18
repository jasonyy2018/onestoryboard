import { logger } from "@/lib/logger";

function isBullMQAbortNoise(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    (err as any).code === "ERR_INVALID_STATE" &&
    (err as Error).message.includes("Controller is already closed")
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
