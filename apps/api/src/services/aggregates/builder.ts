import { sql } from "drizzle-orm";
import { db } from "@dashboard/db";

/**
 * Rebuild daily_aggregates cho TẤT CẢ ngày trong leads của 1 project.
 * Idempotent: DELETE all → INSERT lại từ leads hiện tại.
 */
export async function rebuildAllAggregatesForProject(
  projectId: string,
): Promise<{ rowsBuilt: number }> {
  await db.execute(sql`
    DELETE FROM daily_aggregates WHERE project_id = ${projectId}
  `);

  const result = await db.execute(sql`
    INSERT INTO daily_aggregates
      (snapshot_date, project_id, stage_id, employee_id, fanpage_id, campaign_id, lead_count)
    SELECT
      DATE(fb_created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS snapshot_date,
      project_id,
      current_stage_id,
      current_employee_id,
      fanpage_id,
      campaign_id,
      COUNT(*)::int AS lead_count
    FROM leads
    WHERE project_id = ${projectId}
      AND fb_created_at IS NOT NULL
    GROUP BY snapshot_date, project_id, current_stage_id, current_employee_id, fanpage_id, campaign_id
  `);

  return {
    rowsBuilt: (result as unknown as { rowCount?: number }).rowCount ?? 0,
  };
}

export async function rebuildDailyAggregate(
  projectId: string,
  date: Date,
): Promise<{ rowsBuilt: number }> {
  const dateStr = date.toISOString().slice(0, 10);

  await db.execute(sql`
    DELETE FROM daily_aggregates
    WHERE project_id = ${projectId} AND snapshot_date = ${dateStr}::date
  `);

  const result = await db.execute(sql`
    INSERT INTO daily_aggregates
      (snapshot_date, project_id, stage_id, employee_id, fanpage_id, campaign_id, lead_count)
    SELECT
      ${dateStr}::date,
      project_id,
      current_stage_id,
      current_employee_id,
      fanpage_id,
      campaign_id,
      COUNT(*)::int
    FROM leads
    WHERE project_id = ${projectId}
      AND DATE(fb_created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = ${dateStr}::date
    GROUP BY current_stage_id, current_employee_id, fanpage_id, campaign_id, project_id
  `);

  return {
    rowsBuilt: (result as unknown as { rowCount?: number }).rowCount ?? 0,
  };
}

export async function rebuildDailyAggregatesForDates(
  projectId: string,
  dates: Date[],
): Promise<number> {
  let total = 0;
  for (const d of dates) {
    const r = await rebuildDailyAggregate(projectId, d);
    total += r.rowsBuilt;
  }
  return total;
}
