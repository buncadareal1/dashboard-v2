import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Rebuild daily_aggregates cho TẤT CẢ ngày trong leads của 1 project.
 *
 * Logic: snapshot_date = ngày fb_created_at (theo timezone VN).
 * Group theo: snapshot_date × stage × employee × fanpage × campaign.
 *
 * Idempotent: DELETE all aggregate của project, rồi INSERT lại từ leads hiện tại.
 * Gọi sau mỗi upload CSV (full rebuild) hoặc nightly cron.
 */
export async function rebuildAllAggregatesForProject(
  projectId: string,
): Promise<{ rowsBuilt: number }> {
  // Step 1: Xoá all aggregate của project
  await db.execute(sql`
    DELETE FROM daily_aggregates WHERE project_id = ${projectId}
  `);

  // Step 2: Insert từ leads — snapshot_date = ngày fb_created_at theo TZ VN
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

/**
 * Rebuild aggregate cho 1 (project, date) cụ thể — dùng khi muốn rebuild
 * incremental thay vì full project.
 */
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

/**
 * Rebuild nhiều ngày — Inngest function call sau upload CSV.
 */
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
