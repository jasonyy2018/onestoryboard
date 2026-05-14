import IORedis from "ioredis";
import { env } from "@/lib/env";

/** BullMQ requires a *separate* connection per Worker — don't reuse app-level redis. */
export function createBullConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
