/**
 * Update campaign statusLabel from a CSV file with TRẠNG THÁI column.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/update-campaign-status-from-csv.ts <csv-path>
 */
import { readFileSync } from "node:fs";
import { db } from "../db";
import { campaigns } from "../db/schema";
import { sql, eq } from "drizzle-orm";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npx tsx scripts/update-campaign-status-from-csv.ts <csv-path>");
  process.exit(1);
}

async function main() {
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const header = lines[0].split(",");

  const nameIdx = header.findIndex((h) => h.trim().toUpperCase() === "CAMPAIGN");
  const statusIdx = header.findIndex((h) => h.trim().toUpperCase() === "TRẠNG THÁI");

  if (nameIdx < 0 || statusIdx < 0) {
    console.error("CSV thiếu cột CAMPAIGN hoặc TRẠNG THÁI");
    process.exit(1);
  }

  console.log(`Đọc ${lines.length - 1} campaigns từ CSV...\n`);

  let matched = 0;
  let updated = 0;
  let notFound = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const name = cols[nameIdx]?.trim();
    const status = cols[statusIdx]?.trim().toUpperCase();

    if (!name || !status) continue;
    const newLabel = status === "ON" ? "on" : "off";

    // Find campaign by case-insensitive name match
    const campaign = await db.query.campaigns.findFirst({
      where: sql`lower(trim(regexp_replace(${campaigns.name}, '\\s+', ' ', 'g'))) = lower(trim(regexp_replace(${name}, '\\s+', ' ', 'g')))`,
    });

    if (!campaign) {
      console.log(`  ❌ Không tìm thấy: ${name}`);
      notFound++;
      continue;
    }

    matched++;
    if (campaign.statusLabel !== newLabel) {
      await db
        .update(campaigns)
        .set({ statusLabel: newLabel })
        .where(eq(campaigns.id, campaign.id));
      console.log(`  ✅ ${name}: ${campaign.statusLabel} → ${newLabel}`);
      updated++;
    } else {
      console.log(`  — ${name}: đã ${newLabel} (không đổi)`);
    }
  }

  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`Matched: ${matched} | Updated: ${updated} | Not found: ${notFound}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
