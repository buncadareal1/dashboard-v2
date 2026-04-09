import { and, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { leads, leadSnapshots } from "@/db/schema/leads";
import { inngest } from "@/inngest/client";

/**
 * Nightly snapshot — copy leads created "yesterday VN" → lead_snapshots.
 * Cron: 0 17 * * * UTC = 00:00 Asia/Ho_Chi_Minh (next VN day).
 * Idempotent via unique (snapshot_date, lead_id).
 */
export const nightlySnapshot = inngest.createFunction(
  {
    id: "nightly-snapshot",
    triggers: [{ cron: "0 17 * * *" }],
  },
  async ({ step }) => {
    // Compute snapshot window. Cron fires at 17:00 UTC = 00:00 VN (next day).
    // "Yesterday VN" = the VN day that just ended = the UTC instant range
    // [now - 24h, now). We anchor to the cron fire time.
    const computed = await step.run("compute-date", async () => {
      const now = new Date();
      // Start of today VN in UTC = now - already at 00:00 VN, so end = now
      const endUtc = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          17,
          0,
          0,
        ),
      );
      const startUtc = new Date(endUtc.getTime() - 24 * 60 * 60 * 1000);
      // snapshotDate = yesterday VN = the date of (endUtc + 7h) - 1 day
      // Simpler: snapshotDate = startUtc + 7h, take YYYY-MM-DD
      const vnDay = new Date(startUtc.getTime() + 7 * 60 * 60 * 1000);
      const snapshotDate = vnDay.toISOString().slice(0, 10);
      return {
        snapshotDate,
        startIso: startUtc.toISOString(),
        endIso: endUtc.toISOString(),
      };
    });

    const startUtc = new Date(computed.startIso);
    const endUtc = new Date(computed.endIso);

    const rows = await step.run("load-leads", async () => {
      const found = await db
        .select({
          id: leads.id,
          projectId: leads.projectId,
          stageId: leads.currentStageId,
          employeeId: leads.currentEmployeeId,
          fanpageId: leads.fanpageId,
        })
        .from(leads)
        .where(
          and(gte(leads.createdAt, startUtc), lt(leads.createdAt, endUtc)),
        );
      return found;
    });

    if (rows.length === 0) {
      return { snapshotDate: computed.snapshotDate, rowsCreated: 0 };
    }

    const inserted = await step.run("upsert-snapshots", async () => {
      const result = await db
        .insert(leadSnapshots)
        .values(
          rows.map((r) => ({
            snapshotDate: computed.snapshotDate,
            leadId: r.id,
            projectId: r.projectId,
            stageId: r.stageId ?? null,
            employeeId: r.employeeId ?? null,
            fanpageId: r.fanpageId ?? null,
          })),
        )
        .onConflictDoNothing({
          target: [leadSnapshots.snapshotDate, leadSnapshots.leadId],
        })
        .returning({ id: leadSnapshots.id });
      return result.length;
    });

    return { snapshotDate: computed.snapshotDate, rowsCreated: inserted };
  },
);
