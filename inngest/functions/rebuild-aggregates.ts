import { inngest } from "@/inngest/client";
import { rebuildAllAggregatesForProject } from "@/lib/aggregates/builder";

/**
 * On-demand aggregate rebuild. Send event:
 *   await inngest.send({ name: "aggregate/rebuild", data: { projectId } })
 *
 * dateRange is reserved for future incremental rebuilds; the current
 * builder always does a full project rebuild (idempotent DELETE+INSERT).
 */
export const rebuildAggregates = inngest.createFunction(
  {
    id: "rebuild-aggregates",
    triggers: [{ event: "aggregate/rebuild" }],
  },
  async ({ event, step }) => {
    const data = ((event as { data?: unknown }).data ?? {}) as {
      projectId?: string;
      dateRange?: { from: string; to: string };
    };
    if (!data.projectId) {
      throw new Error("rebuild-aggregates: missing projectId in event.data");
    }
    const projectId = data.projectId;

    const result = await step.run("rebuild", async () => {
      return await rebuildAllAggregatesForProject(projectId);
    });

    return { projectId, ...result };
  },
);
