/**
 * Import "Tình trạng" (stage) từ RAW_LEAD CSV — update lead status bulk.
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-lead-status-csv.ts \
 *     <file-path> <project-slug>
 *
 * CSV format:
 *   Created Time,DATE CLEAN,Full Name,Phone,Email,Tình trạng,Campaign,Adset,Ad,...
 *
 * Match lead bằng (projectId, phoneNormalized). Nếu stage khác current → update
 * leads.currentStageId và insert lead_stage_events. Idempotent.
 */
import { readFileSync } from "node:fs";
import { db } from "../db";
import { projects } from "../db/schema";
import { leads, leadStageEvents } from "../db/schema/leads";
import { stages, stageAliases } from "../db/schema/stages";
import { and, eq } from "drizzle-orm";
import { normalizePhone, normalizeName } from "../lib/utils/unicode";
import { campaigns } from "../db/schema/ads";

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
      } else if (c === '"') inQ = false;
      else cur += c;
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

function parseMultilineCsv(text: string): string[] {
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
  return lines;
}

async function main() {
  const filePath = process.argv[2];
  const slug = process.argv[3];
  if (!filePath || !slug) {
    console.error(
      "Usage: tsx scripts/import-lead-status-csv.ts <file> <project-slug>",
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

  // Load stage aliases (case-insensitive map)
  const allStages = await db.select().from(stages);
  const allAliases = await db.select().from(stageAliases);
  const stageByAlias = new Map<string, string>();
  for (const a of allAliases) {
    if (a.stageId) stageByAlias.set(a.raw.trim().toLowerCase(), a.stageId);
  }
  // Also allow stage code + labelVi as direct match
  for (const s of allStages) {
    stageByAlias.set(s.code.toLowerCase(), s.id);
    stageByAlias.set(s.labelVi.trim().toLowerCase(), s.id);
  }

  const raw = readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = parseMultilineCsv(raw);
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const phoneIdx = header.indexOf("Phone");
  const nameIdx = header.indexOf("Full Name");
  const statusIdx = header.findIndex((h) => h === "Tình trạng");
  const campIdx = header.indexOf("Campaign");
  if (statusIdx < 0 || nameIdx < 0) {
    console.error("Missing columns. Got header:", header);
    process.exit(1);
  }
  console.log(
    `name col: ${nameIdx}, phone col: ${phoneIdx}, status col: ${statusIdx}, campaign col: ${campIdx}`,
  );

  type Row = {
    phoneNorm: string | null;
    nameNorm: string;
    campaignRaw: string;
    statusRaw: string;
  };
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const phone = cells[phoneIdx] ?? "";
    const name = cells[nameIdx] ?? "";
    const statusRaw = (cells[statusIdx] ?? "").trim();
    const campaignRaw = (cells[campIdx] ?? "").trim();
    if (!statusRaw) continue;
    const nameNorm = normalizeName(name);
    if (!nameNorm) continue;
    const phoneNorm = phone ? normalizePhone(phone) || null : null;
    rows.push({ phoneNorm, nameNorm, campaignRaw, statusRaw });
  }
  console.log(`parsed ${rows.length} rows with name + status`);

  // Load all leads of this project keyed by phone + by (campaignId, nameNorm)
  const projectLeads = await db
    .select({
      id: leads.id,
      phoneNormalized: leads.phoneNormalized,
      fullNameNormalized: leads.fullNameNormalized,
      campaignId: leads.campaignId,
      currentStageId: leads.currentStageId,
    })
    .from(leads)
    .where(eq(leads.projectId, project.id));
  const leadByPhone = new Map<string, (typeof projectLeads)[number]>();
  const leadByNameCamp = new Map<string, (typeof projectLeads)[number]>();
  for (const l of projectLeads) {
    if (l.phoneNormalized) leadByPhone.set(l.phoneNormalized, l);
    if (l.fullNameNormalized && l.campaignId)
      leadByNameCamp.set(`${l.campaignId}::${l.fullNameNormalized}`, l);
  }
  console.log(`project has ${projectLeads.length} leads total`);

  // Preload campaigns by name for name-based fallback
  const projectCamps = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.projectId, project.id));
  const campIdByName = new Map<string, string>();
  for (const c of projectCamps) campIdByName.set(c.name.toLowerCase(), c.id);

  let updated = 0;
  let noChange = 0;
  let notFound = 0;
  let matchedByName = 0;
  const unknownStages = new Map<string, number>();

  for (const r of rows) {
    let lead = r.phoneNorm ? leadByPhone.get(r.phoneNorm) : undefined;
    if (!lead && r.campaignRaw) {
      const campId = campIdByName.get(r.campaignRaw.toLowerCase());
      if (campId) {
        lead = leadByNameCamp.get(`${campId}::${r.nameNorm}`);
        if (lead) matchedByName++;
      }
    }
    if (!lead) {
      notFound++;
      continue;
    }
    const stageId = stageByAlias.get(r.statusRaw.toLowerCase());
    if (!stageId) {
      unknownStages.set(r.statusRaw, (unknownStages.get(r.statusRaw) ?? 0) + 1);
      continue;
    }
    if (lead.currentStageId === stageId) {
      noChange++;
      continue;
    }
    const prevStageId = lead.currentStageId;
    await db
      .update(leads)
      .set({ currentStageId: stageId, updatedAt: new Date() })
      .where(eq(leads.id, lead.id));
    await db.insert(leadStageEvents).values({
      leadId: lead.id,
      projectId: project.id,
      fromStageId: prevStageId,
      toStageId: stageId,
      source: "manual",
    });
    updated++;
  }

  console.log(
    `\n✅ updated=${updated}  noChange=${noChange}  notFound=${notFound}  matchedByName=${matchedByName}`,
  );
  if (unknownStages.size > 0) {
    console.log("\n⚠️  Unknown stages (add alias):");
    for (const [s, n] of unknownStages) console.log(`   "${s}" × ${n}`);
  }
}

main().then(() => process.exit(0));
