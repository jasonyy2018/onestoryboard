import IORedis, { type Redis } from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * Single shared connection for app-side use (publish/subscribe, KV).
 * BullMQ Workers create their own connection internally — see lib/queue.
 */
export const redis: Redis =
  globalForRedis.redis ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: false,
  });

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
