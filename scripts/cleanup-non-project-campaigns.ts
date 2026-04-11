/**
 * Remove campaigns that don't belong to Sun Hà Nam project.
 * Run: npx dotenv -e .env.local -- npx tsx scripts/cleanup-non-project-campaigns.ts
 */
import { db } from "../db";
import { campaigns, campaignInsights } from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const SUN_HA_NAM_PATTERN = "sun.*h[àa].*nam|SUN.*HN";

  const toDelete = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(sql`${campaigns.name} !~* ${SUN_HA_NAM_PATTERN}`);

  console.log(`Deleting ${toDelete.length} campaigns not belonging to Sun Hà Nam:`);
  for (const c of toDelete) {
    console.log(`  ❌ ${c.name}`);
  }

  // Delete insights first (FK), then campaigns
  for (const c of toDelete) {
    await db.delete(campaignInsights).where(eq(campaignInsights.campaignId, c.id));
    await db.delete(campaigns).where(eq(campaigns.id, c.id));
  }

  // Verify
  const [remaining] = await db.select({ count: sql<number>`count(*)::int` }).from(campaigns);
  const [insightCount] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignInsights);
  const [totalSpend] = await db.select({ total: sql<number>`coalesce(sum(spend::numeric), 0)::float` }).from(campaignInsights);

  console.log(`\nRemaining campaigns: ${remaining.count}`);
  console.log(`Remaining insights: ${insightCount.count}`);
  console.log(`Total spend (Sun Hà Nam only): ${Math.round(totalSpend.total).toLocaleString("vi")} đ`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
