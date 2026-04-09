import { sql } from "drizzle-orm";
import { db } from "@/db";
import { inngest } from "@/inngest/client";

/**
 * Nightly archive — rollup lead_snapshots older than 90 days into
 * monthly_aggregates, then delete raw snapshot rows.
 * Cron: 30 17 * * * UTC = 00:30 Asia/Ho_Chi_Minh.
 *
 * monthly_aggregates columns mapped from lead_snapshots:
 *   year_month  ← date_trunc('month', snapshot_date)
 *   project_id  ← project_id
 *   stage_id    ← stage_id
 *   employee_id ← employee_id
 *   lead_count  ← COUNT(DISTINCT lead_id)
 * (fanpage_id from snapshots is dropped — monthly_aggregates has no fanpage column.)
 */
export const nightlyArchive = inngest.createFunction(
  {
    id: "nightly-archive",
    triggers: [{ cron: "30 17 * * *" }],
  },
  async ({ step }) => {
    const stale = await step.run("find-stale", async () => {
      const result = await db.execute(sql`
        SELECT DISTINCT
          project_id::text AS project_id,
          to_char(date_trunc('month', snapshot_date), 'YYYY-MM-DD') AS year_month
        FROM lead_snapshots
        WHERE snapshot_date < (CURRENT_DATE - INTERVAL '90 days')
      `);
      const rows = (result as unknown as { rows?: Array<Record<string, unknown>> })
        .rows
      ?? (result as unknown as Array<Record<string, unknown>>);
      return (rows as Array<{ project_id: string; year_month: string }>).map(
        (r) => ({ projectId: r.project_id, yearMonth: r.year_month }),
      );
    });

    if (stale.length === 0) {
      return { rolledUp: 0, deleted: 0 };
    }

    let rolledUp = 0;
    let deleted = 0;

    for (const { projectId, yearMonth } of stale) {
      const stepId = `rollup-${projectId}-${yearMonth}`;
      const out = await step.run(stepId, async () => {
        // Upsert aggregate rows, one per (stage, employee).
        const upsertResult = await db.execute(sql`
          INSERT INTO monthly_aggregates
            (year_month, project_id, stage_id, employee_id, lead_count)
          SELECT
            date_trunc('month', snapshot_date)::date,
            project_id,
            stage_id,
            employee_id,
            COUNT(DISTINCT lead_id)::int
          FROM lead_snapshots
          WHERE project_id = ${projectId}
            AND date_trunc('month', snapshot_date)::date = ${yearMonth}::date
          GROUP BY date_trunc('month', snapshot_date), project_id, stage_id, employee_id
          ON CONFLICT ON CONSTRAINT monthly_aggregates_uk
          DO UPDATE SET lead_count = EXCLUDED.lead_count
        `);

        const delResult = await db.execute(sql`
          DELETE FROM lead_snapshots
          WHERE project_id = ${projectId}
            AND date_trunc('month', snapshot_date)::date = ${yearMonth}::date
        `);

        const upCount =
          (upsertResult as unknown as { rowCount?: number }).rowCount ?? 0;
        const delCount =
          (delResult as unknown as { rowCount?: number }).rowCount ?? 0;
        return { upCount, delCount };
      });
      rolledUp += out.upCount;
      deleted += out.delCount;
    }

    return { rolledUp, deleted };
  },
);
