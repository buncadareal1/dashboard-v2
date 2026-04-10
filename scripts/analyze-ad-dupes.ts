import { db } from "../db";
import { ads, adsets, campaigns } from "../db/schema";
import { sql } from "drizzle-orm";

async function main() {
  // 1. Total counts
  const totalAds = await db.select({ count: sql<number>`count(*)::int` }).from(ads);
  const totalAdsets = await db.select({ count: sql<number>`count(*)::int` }).from(adsets);
  const totalCampaigns = await db.select({ count: sql<number>`count(*)::int` }).from(campaigns);
  console.log(`Total: ${totalCampaigns[0].count} campaigns, ${totalAdsets[0].count} adsets, ${totalAds[0].count} ads\n`);

  // 2. Ads with same name across different adsets in same project
  const projDupes = await db.execute(sql`
    SELECT a.project_id, a.name, count(*) as cnt,
           array_agg(DISTINCT ad.name) as adset_names
    FROM ads a
    JOIN adsets ad ON a.adset_id = ad.id
    GROUP BY a.project_id, a.name
    HAVING count(*) > 1
    ORDER BY cnt DESC
    LIMIT 15
  `);
  console.log(`Ads duplicated across adsets (same project+name): ${(projDupes as unknown as {rows: unknown[]}).rows?.length ?? 0}`);
  for (const r of ((projDupes as unknown as {rows: Array<{name: string; cnt: number; adset_names: string[]}>}).rows ?? []).slice(0, 10)) {
    console.log(`  "${r.name}" → ${r.cnt} copies across adsets: ${JSON.stringify(r.adset_names).slice(0, 80)}`);
  }

  // 3. Check CSV data: how many leads share same Ad name but different Adset
  const leadAdDist = await db.execute(sql`
    SELECT a.name as ad_name, count(DISTINCT a.adset_id) as adset_count, count(DISTINCT a.id) as ad_row_count
    FROM ads a
    WHERE a.project_id IS NOT NULL
    GROUP BY a.name
    HAVING count(DISTINCT a.adset_id) > 1
    ORDER BY count(DISTINCT a.adset_id) DESC
    LIMIT 10
  `);
  console.log(`\nAd names appearing in multiple adsets:`);
  for (const r of ((leadAdDist as unknown as {rows: Array<{ad_name: string; adset_count: number; ad_row_count: number}>}).rows ?? [])) {
    console.log(`  "${r.ad_name}" → in ${r.adset_count} different adsets, ${r.ad_row_count} ad rows`);
  }

  // 4. Root cause: check if CSV has same Ad name under different Adset names
  const csvPattern = await db.execute(sql`
    SELECT a.name as ad_name, ad.name as adset_name, c.name as campaign_name
    FROM ads a
    JOIN adsets ad ON a.adset_id = ad.id
    JOIN campaigns c ON ad.campaign_id = c.id
    WHERE a.name = (
      SELECT name FROM ads GROUP BY name HAVING count(DISTINCT adset_id) > 1 ORDER BY count(DISTINCT adset_id) DESC LIMIT 1
    )
    ORDER BY c.name, ad.name
    LIMIT 15
  `);
  console.log(`\nSample: most duplicated ad across its adsets/campaigns:`);
  for (const r of ((csvPattern as unknown as {rows: Array<{ad_name: string; adset_name: string; campaign_name: string}>}).rows ?? [])) {
    console.log(`  ad: "${r.ad_name}" | adset: "${r.adset_name}" | campaign: "${r.campaign_name}"`);
  }

  // 5. Check unique constraint
  const uniqueCheck = await db.execute(sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'ads' AND indexname LIKE '%uk%' OR indexname LIKE '%unique%'
    ORDER BY indexname
  `);
  console.log(`\nUnique indexes on ads table:`);
  for (const r of ((uniqueCheck as unknown as {rows: Array<{indexname: string; indexdef: string}>}).rows ?? [])) {
    console.log(`  ${r.indexname}: ${r.indexdef}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
