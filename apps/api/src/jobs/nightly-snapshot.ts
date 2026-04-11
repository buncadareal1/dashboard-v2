import { Worker } from "bullmq";
import { workerRedis } from "./queue.js";

/**
 * Nightly jobs:
 * - snapshot: copy current lead state → lead_snapshots
 * - archive: rollup snapshots > 90 days → monthly_aggregates
 * - rebuild: rebuild daily_aggregates cho all projects
 *
 * Chạy qua BullMQ repeatable job (thay Inngest cron).
 */

export const nightlyWorker = new Worker(
  "nightly",
  async (job) => {
    const task = job.name;
    console.log(`[nightly] Running ${task}...`);

    switch (task) {
      case "snapshot":
        // TODO: migrate logic từ inngest/functions/nightly-snapshot
        console.log("[nightly] Snapshot — stub");
        break;

      case "archive":
        // TODO: migrate logic từ inngest/functions/nightly-archive
        console.log("[nightly] Archive — stub");
        break;

      case "rebuild-aggregates":
        // TODO: migrate logic từ inngest/functions/rebuild-aggregates
        console.log("[nightly] Rebuild aggregates — stub");
        break;

      default:
        console.warn(`[nightly] Unknown task: ${task}`);
    }
  },
  {
    connection: workerRedis,
    concurrency: 1,
  },
);
