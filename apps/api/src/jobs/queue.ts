import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

// Separate connections: Queue (producer) and Worker (consumer) must not share
// a connection — BLPOP in Worker blocks the connection and starves Queue commands.
export const queueRedis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const workerRedis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const csvQueue = new Queue("csv-processing", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const fbSyncQueue = new Queue("fb-sync", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  },
});

export const nightlyQueue = new Queue("nightly", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 30 },
  },
});
