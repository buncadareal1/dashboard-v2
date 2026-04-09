import { db } from "../db";
import { leads, leadSnapshots } from "../db/schema/leads";
import { and, gte, lt, sql } from "drizzle-orm";

async function main() {
  const now = new Date();
  const endUtc = now;
  const startUtc = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const snapshotDate = new Date(startUtc.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows = await db
    .select({
      leadId: leads.id,
      projectId: leads.projectId,
      stageId: leads.currentStageId,
      employeeId: leads.currentEmployeeId,
      fanpageId: leads.fanpageId,
    })
    .from(leads)
    .where(and(gte(leads.createdAt, startUtc), lt(leads.createdAt, endUtc)));

  console.log(
    "window:",
    startUtc.toISOString(),
    "→",
    endUtc.toISOString(),
    "snapshotDate=",
    snapshotDate,
  );
  console.log("leads in 24h window:", rows.length);

  const total = await db.execute(sql`SELECT COUNT(*)::int AS n FROM leads`);
  const snapBefore = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM lead_snapshots`,
  );
  console.log("total leads DB:", total.rows?.[0], "snapshots before:", snapBefore.rows?.[0]);

  // Seed a test snapshot for a known lead (first lead in DB) to verify insert path
  const anyLead = await db
    .select({
      id: leads.id,
      projectId: leads.projectId,
      stageId: leads.currentStageId,
      employeeId: leads.currentEmployeeId,
      fanpageId: leads.fanpageId,
    })
    .from(leads)
    .limit(1);

  if (anyLead.length > 0) {
    const l = anyLead[0];
    const testDate = "2025-01-01";
    await db
      .insert(leadSnapshots)
      .values({
        snapshotDate: testDate,
        leadId: l.id,
        projectId: l.projectId,
        stageId: l.stageId,
        employeeId: l.employeeId,
        fanpageId: l.fanpageId,
      })
      .onConflictDoNothing();
    console.log("inserted test snapshot for lead", l.id, "on", testDate);
  }

  const snapAfter = await db.execute(
    sql`SELECT COUNT(*)::int AS n, MAX(snapshot_date) AS latest FROM lead_snapshots`,
  );
  console.log("snapshots after:", snapAfter.rows?.[0]);
}

main().then(() => process.exit(0));
