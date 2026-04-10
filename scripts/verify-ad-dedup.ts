import { db } from "../db";
import { ads, leads, stages } from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const projectId = "820b3c60-0090-4973-a701-3e0ff9bea7f8";

  // Old way: group by ads.id
  const oldRows = await db
    .select({ name: ads.name, adId: ads.id })
    .from(ads)
    .where(eq(ads.projectId, projectId));
  console.log(`Old (group by ads.id): ${oldRows.length} rows in table`);

  // New way: group by ads.name
  const newRows = await db
    .select({
      name: ads.name,
      totalLead: sql<number>`count(${leads.id})::int`,
      instanceCount: sql<number>`count(DISTINCT ${ads.id})::int`,
    })
    .from(ads)
    .leftJoin(leads, eq(leads.adId, ads.id))
    .leftJoin(stages, eq(leads.currentStageId, stages.id))
    .where(eq(ads.projectId, projectId))
    .groupBy(ads.name);
  console.log(`New (group by ads.name): ${newRows.length} unique creatives`);
  console.log(`\nReduction: ${oldRows.length} → ${newRows.length} (${Math.round((1 - newRows.length / oldRows.length) * 100)}% less)`);

  console.log(`\nTop 5 creatives:`);
  const sorted = [...newRows].sort((a: { totalLead: number }, b: { totalLead: number }) => b.totalLead - a.totalLead);
  for (const r of sorted.slice(0, 5) as Array<{ name: string; totalLead: number; instanceCount: number }>) {
    console.log(`  "${r.name}" → ${r.totalLead} leads (${r.instanceCount} instances merged)`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
