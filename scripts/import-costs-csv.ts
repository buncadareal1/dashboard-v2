/**
 * Import chi phí ads từ CSV "BC NGÂN SÁCH" vào project_costs.
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-costs-csv.ts \
 *     <file-path> <project-slug>
 *
 * CSV format expected:
 *   STT,NGÀY,CHI TIÊU,LEAD,F1,...
 *   1,05/02/2026,"2.270.065 đ",8,4,...
 *
 * Insert mỗi ngày 1 row (source='manual'). Idempotent qua unique key
 * (project_id, period_date, source).
 */
import { readFileSync } from "node:fs";
import { db } from "../db";
import { projects } from "../db/schema";
import { projectCosts } from "../db/schema/ops";
import { eq } from "drizzle-orm";

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  // "2.270.065 đ" → 2270065
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDateDMY(raw: string): string | null {
  // "05/02/2026" → "2026-02-05"
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Split a CSV line handling quoted fields (papaparse-lite). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  const filePath = process.argv[2];
  const slug = process.argv[3];
  if (!filePath || !slug) {
    console.error(
      "Usage: tsx scripts/import-costs-csv.ts <file> <project-slug>",
    );
    process.exit(1);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });
  if (!project) {
    console.error(`Project not found: ${slug}`);
    process.exit(1);
  }
  console.log(`Project: ${project.name} (${project.id})`);

  const raw = readFileSync(filePath, "utf-8");
  // Strip BOM if present
  const text = raw.replace(/^\uFEFF/, "");
  // Naive multi-line CSV: some cells contain newlines inside quotes.
  // Handle that by walking the file char-by-char and splitting on \n
  // only when not inside quotes.
  const lines: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQ = !inQ;
    if (c === "\n" && !inQ) {
      lines.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur) lines.push(cur);

  // Line 0 = header
  const header = splitCsvLine(lines[0]);
  const dateIdx = header.findIndex((h) => h.trim().toUpperCase() === "NGÀY");
  const costIdx = header.findIndex((h) => h.trim().toUpperCase() === "CHI TIÊU");
  if (dateIdx < 0 || costIdx < 0) {
    console.error("Header missing NGÀY / CHI TIÊU. Got:", header);
    process.exit(1);
  }
  console.log(`date col: ${dateIdx}, cost col: ${costIdx}`);

  const rows: { periodDate: string; amount: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const dateRaw = cells[dateIdx] ?? "";
    const costRaw = cells[costIdx] ?? "";
    const periodDate = parseDateDMY(dateRaw);
    const amount = parseMoney(costRaw);
    if (periodDate && amount) {
      rows.push({ periodDate, amount });
    }
  }
  console.log(`parsed ${rows.length} non-empty daily rows`);

  if (rows.length === 0) {
    console.log("nothing to insert");
    return;
  }

  // Bulk upsert (source='manual')
  let inserted = 0;
  let updated = 0;
  for (const r of rows) {
    const result = await db
      .insert(projectCosts)
      .values({
        projectId: project.id,
        periodDate: r.periodDate,
        amount: r.amount.toString(),
        source: "manual",
      })
      .onConflictDoUpdate({
        target: [
          projectCosts.projectId,
          projectCosts.periodDate,
          projectCosts.source,
        ],
        set: { amount: r.amount.toString() },
      })
      .returning({ id: projectCosts.id });
    if (result.length > 0) inserted++;
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  console.log(
    `✅ upserted ${inserted}/${rows.length} rows. total=${total.toLocaleString("vi-VN")} đ`,
  );
}

main().then(() => process.exit(0));
