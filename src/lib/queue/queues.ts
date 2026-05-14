import { FlowProducer, Queue, QueueEvents } from "bullmq";
import { createBullConnection } from "./connection";

export const QUEUE_NAMES = {
  parse: "parse",
  shot: "shot",
  compose: "compose",
  asset: "asset",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Singletons (re-used across Server Actions / route handlers).
const globalForQueue = globalThis as unknown as {
  flowProducer?: FlowProducer;
  queues?: Record<QueueName, Queue>;
  events?: Record<QueueName, QueueEvents>;
};

export const flowProducer =
  globalForQueue.flowProducer ??
  new FlowProducer({ connection: createBullConnection() });

function makeQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: createBullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  });
}

export const queues: Record<QueueName, Queue> =
  globalForQueue.queues ??
  ({
    parse: makeQueue("parse"),
    shot: makeQueue("shot"),
    compose: makeQueue("compose"),
    asset: makeQueue("asset"),
  } as Record<QueueName, Queue>);

export const events: Record<QueueName, QueueEvents> =
  globalForQueue.events ??
  ({
    parse: new QueueEvents("parse", { connection: createBullConnection() }),
    shot: new QueueEvents("shot", { connection: createBullConnection() }),
    compose: new QueueEvents("compose", { connection: createBullConnection() }),
    asset: new QueueEvents("asset", { connection: createBullConnection() }),
  } as Record<QueueName, QueueEvents>);

if (process.env.NODE_ENV !== "production") {
  globalForQueue.flowProducer = flowProducer;
  globalForQueue.queues = queues;
  globalForQueue.events = events;
}
