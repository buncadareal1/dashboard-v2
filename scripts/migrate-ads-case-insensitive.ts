/**
 * Migration: convert ads/adsets/campaigns unique constraints to functional
 * unique indexes (case + whitespace-insensitive).
 *
 * Steps:
 *   1. Dedupe existing campaigns by (project_id, lower(trim(collapse(name))))
 *      — reassign adsets/leads to canonical, delete dupes
 *   2. Dedupe adsets similarly (reassign ads/leads)
 *   3. Dedupe ads (reassign leads)
 *   4. Drop old unique constraints
 *   5. Create new functional unique indexes
 *
 * Idempotent — re-runnable. Wrap in transaction... neon-http doesn't
 * support transactions so we run steps sequentially.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

const NORM = `lower(trim(regexp_replace(name, '\\s+', ' ', 'g')))`;

async function main() {
  console.log("=== Phase 1: dedupe campaigns ===");
  // Find duplicate groups by normalized name within project
  const dupCamps = await db.execute(sql.raw(`
    SELECT project_id, ${NORM} AS norm, array_agg(id ORDER BY created_at) AS ids
    FROM campaigns
    GROUP BY project_id, ${NORM}
    HAVING COUNT(*) > 1
  `));
  console.log("dup campaign groups:", dupCamps.rows.length);
  for (const g of dupCamps.rows as Array<{
    project_id: string;
    norm: string;
    ids: string[];
  }>) {
    const [canonical, ...dupes] = g.ids;
    console.log(`  merging ${dupes.length} dupes of "${g.norm}" → ${canonical.slice(0, 8)}`);
    // Reassign adsets
    for (const d of dupes) {
      await db.execute(
        sql`UPDATE adsets SET campaign_id = ${canonical}::uuid WHERE campaign_id = ${d}::uuid`,
      );
      await db.execute(
        sql`UPDATE leads SET campaign_id = ${canonical}::uuid WHERE campaign_id = ${d}::uuid`,
      );
      await db.execute(sql`DELETE FROM campaigns WHERE id = ${d}::uuid`);
    }
  }

  console.log("\n=== Phase 2: dedupe adsets ===");
  const dupAs = await db.execute(sql.raw(`
    SELECT campaign_id, ${NORM} AS norm, array_agg(id ORDER BY id) AS ids
    FROM adsets
    GROUP BY campaign_id, ${NORM}
    HAVING COUNT(*) > 1
  `));
  console.log("dup adset groups:", dupAs.rows.length);
  for (const g of dupAs.rows as Array<{ ids: string[] }>) {
    const [canonical, ...dupes] = g.ids;
    for (const d of dupes) {
      await db.execute(
        sql`UPDATE ads SET adset_id = ${canonical}::uuid WHERE adset_id = ${d}::uuid`,
      );
      await db.execute(
        sql`UPDATE leads SET adset_id = ${canonical}::uuid WHERE adset_id = ${d}::uuid`,
      );
      await db.execute(sql`DELETE FROM adsets WHERE id = ${d}::uuid`);
    }
  }

  console.log("\n=== Phase 3: dedupe ads ===");
  const dupAds = await db.execute(sql.raw(`
    SELECT adset_id, ${NORM} AS norm, array_agg(id ORDER BY id) AS ids
    FROM ads
    GROUP BY adset_id, ${NORM}
    HAVING COUNT(*) > 1
  `));
  console.log("dup ad groups:", dupAds.rows.length);
  for (const g of dupAds.rows as Array<{ ids: string[] }>) {
    const [canonical, ...dupes] = g.ids;
    for (const d of dupes) {
      await db.execute(
        sql`UPDATE leads SET ad_id = ${canonical}::uuid WHERE ad_id = ${d}::uuid`,
      );
      await db.execute(sql`DELETE FROM ads WHERE id = ${d}::uuid`);
    }
  }

  console.log("\n=== Phase 4: drop old constraints ===");
  await db.execute(
    sql`ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_project_name_uk`,
  );
  await db.execute(
    sql`ALTER TABLE adsets DROP CONSTRAINT IF EXISTS adsets_campaign_name_uk`,
  );
  await db.execute(
    sql`ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_adset_name_uk`,
  );
  console.log("dropped old unique constraints");

  console.log("\n=== Phase 5: create functional unique indexes ===");
  await db.execute(
    sql`DROP INDEX IF EXISTS campaigns_project_name_norm_uk`,
  );
  await db.execute(
    sql.raw(`CREATE UNIQUE INDEX campaigns_project_name_norm_uk ON campaigns (project_id, ${NORM})`),
  );
  await db.execute(sql`DROP INDEX IF EXISTS adsets_campaign_name_norm_uk`);
  await db.execute(
    sql.raw(`CREATE UNIQUE INDEX adsets_campaign_name_norm_uk ON adsets (campaign_id, ${NORM})`),
  );
  await db.execute(sql`DROP INDEX IF EXISTS ads_adset_name_norm_uk`);
  await db.execute(
    sql.raw(`CREATE UNIQUE INDEX ads_adset_name_norm_uk ON ads (adset_id, ${NORM})`),
  );
  console.log("created functional unique indexes");

  console.log("\n✅ migration done");
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
