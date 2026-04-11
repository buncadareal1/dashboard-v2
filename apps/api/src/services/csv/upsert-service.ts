import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@dashboard/db";
import {
  leads,
  leadStageEvents,
  campaigns,
  adsets,
  ads,
  employees,
  stages,
  stageAliases,
  matchConflicts,
  projectCosts,
} from "@dashboard/db/schema";
import { matchLead, type LeadCandidate } from "./matcher.js";
import { resolveStage } from "./stage-mapper.js";
import { entityLookupKey } from "../utils/unicode.js";
import type {
  FacebookLeadInput,
  BitrixUpdateInput,
} from "../adapters/lead-source.js";

type UpsertContext = {
  projectId: string;
  csvUploadId: string;
};

type UpsertSummary = {
  inserted: number;
  updated: number;
  conflicts: number;
  pendingAliases: number;
};

async function loadStageAliasMap(): Promise<Map<string, string | null>> {
  const [aliasRows, stageRows] = await Promise.all([
    db.select().from(stageAliases),
    db.select().from(stages),
  ]);
  const map = new Map<string, string | null>();
  for (const s of stageRows) {
    map.set(entityLookupKey(s.code), s.id);
    map.set(entityLookupKey(s.labelVi), s.id);
  }
  for (const a of aliasRows) {
    map.set(entityLookupKey(a.raw), a.stageId);
  }
  return map;
}

async function loadCandidates(
  projectId: string,
  incomingNames: string[],
): Promise<LeadCandidate[]> {
  if (incomingNames.length === 0) return [];
  const rows = await db
    .select({
      id: leads.id,
      fullNameNormalized: leads.fullNameNormalized,
      phoneNormalized: leads.phoneNormalized,
    })
    .from(leads)
    .where(
      and(
        eq(leads.projectId, projectId),
        inArray(leads.fullNameNormalized, incomingNames),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    fullNameNormalized: r.fullNameNormalized,
    phoneNormalized: r.phoneNormalized,
  }));
}

async function buildAdTaxonomyMaps(
  projectId: string,
  rows: Array<{
    campaignName: string | null;
    adsetName: string | null;
    adName: string | null;
    formName: string | null;
  }>,
): Promise<{
  campaignMap: Map<string, string>;
  adsetMap: Map<string, string>;
  adMap: Map<string, string>;
}> {
  const existingCampaigns = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.projectId, projectId));
  const campaignIdByNorm = new Map<string, string>();
  for (const c of existingCampaigns) {
    campaignIdByNorm.set(entityLookupKey(c.name), c.id);
  }

  const incomingCampaignNames = new Set<string>();
  for (const r of rows) {
    if (r.campaignName) incomingCampaignNames.add(r.campaignName);
  }
  const toInsertCampaigns: Array<{
    projectId: string;
    name: string;
    statusLabel: "on";
  }> = [];
  const insertedNormKeys = new Set<string>();
  for (const name of incomingCampaignNames) {
    const key = entityLookupKey(name);
    if (!campaignIdByNorm.has(key) && !insertedNormKeys.has(key)) {
      toInsertCampaigns.push({ projectId, name, statusLabel: "on" });
      insertedNormKeys.add(key);
    }
  }
  if (toInsertCampaigns.length > 0) {
    const inserted = await db
      .insert(campaigns)
      .values(toInsertCampaigns)
      .onConflictDoNothing()
      .returning({ id: campaigns.id, name: campaigns.name });
    for (const c of inserted) {
      campaignIdByNorm.set(entityLookupKey(c.name), c.id);
    }
    const stillMissing = toInsertCampaigns.filter(
      (t) => !campaignIdByNorm.has(entityLookupKey(t.name)),
    );
    if (stillMissing.length > 0) {
      const refetch = await db
        .select({ id: campaigns.id, name: campaigns.name })
        .from(campaigns)
        .where(eq(campaigns.projectId, projectId));
      for (const c of refetch)
        campaignIdByNorm.set(entityLookupKey(c.name), c.id);
    }
  }
  const campaignMap = new Map<string, string>();
  for (const name of incomingCampaignNames) {
    const id = campaignIdByNorm.get(entityLookupKey(name));
    if (id) campaignMap.set(name, id);
  }

  const distinctCampaignIdsForAdsets = [...new Set(campaignMap.values())];
  const existingAdsets =
    distinctCampaignIdsForAdsets.length > 0
      ? await db
          .select({
            id: adsets.id,
            campaignId: adsets.campaignId,
            name: adsets.name,
          })
          .from(adsets)
          .where(inArray(adsets.campaignId, distinctCampaignIdsForAdsets))
      : [];
  const adsetIdByKey = new Map<string, string>();
  for (const a of existingAdsets) {
    adsetIdByKey.set(`${a.campaignId}\x00${entityLookupKey(a.name)}`, a.id);
  }
  const toInsertAdsets: Array<{ campaignId: string; name: string }> = [];
  const adsetSeen = new Set<string>();
  for (const r of rows) {
    if (!r.campaignName || !r.adsetName) continue;
    const cid = campaignMap.get(r.campaignName);
    if (!cid) continue;
    const key = `${cid}\x00${entityLookupKey(r.adsetName)}`;
    if (adsetIdByKey.has(key) || adsetSeen.has(key)) continue;
    toInsertAdsets.push({ campaignId: cid, name: r.adsetName });
    adsetSeen.add(key);
  }
  if (toInsertAdsets.length > 0) {
    const inserted = await db
      .insert(adsets)
      .values(toInsertAdsets)
      .onConflictDoNothing()
      .returning({
        id: adsets.id,
        campaignId: adsets.campaignId,
        name: adsets.name,
      });
    for (const a of inserted) {
      adsetIdByKey.set(`${a.campaignId}\x00${entityLookupKey(a.name)}`, a.id);
    }
  }
  const adsetMap = new Map<string, string>();
  for (const r of rows) {
    if (!r.campaignName || !r.adsetName) continue;
    const cid = campaignMap.get(r.campaignName);
    if (!cid) continue;
    const id = adsetIdByKey.get(`${cid}\x00${entityLookupKey(r.adsetName)}`);
    if (id) adsetMap.set(`${cid}\x00${r.adsetName}`, id);
  }

  const distinctAdsetIds = [...new Set(adsetMap.values())];
  const existingAds =
    distinctAdsetIds.length > 0
      ? await db
          .select({
            id: ads.id,
            adsetId: ads.adsetId,
            name: ads.name,
          })
          .from(ads)
          .where(inArray(ads.adsetId, distinctAdsetIds))
      : [];
  const adIdByKey = new Map<string, string>();
  for (const a of existingAds) {
    adIdByKey.set(`${a.adsetId}\x00${entityLookupKey(a.name)}`, a.id);
  }
  const toInsertAds: Array<{
    adsetId: string;
    projectId: string;
    name: string;
    formName: string | null;
  }> = [];
  const adSeen = new Set<string>();
  for (const r of rows) {
    if (!r.campaignName || !r.adsetName || !r.adName) continue;
    const cid = campaignMap.get(r.campaignName);
    if (!cid) continue;
    const asid = adsetMap.get(`${cid}\x00${r.adsetName}`);
    if (!asid) continue;
    const key = `${asid}\x00${entityLookupKey(r.adName)}`;
    if (adIdByKey.has(key) || adSeen.has(key)) continue;
    toInsertAds.push({
      adsetId: asid,
      projectId,
      name: r.adName,
      formName: r.formName,
    });
    adSeen.add(key);
  }
  if (toInsertAds.length > 0) {
    const inserted = await db
      .insert(ads)
      .values(toInsertAds)
      .onConflictDoNothing()
      .returning({ id: ads.id, adsetId: ads.adsetId, name: ads.name });
    for (const a of inserted) {
      adIdByKey.set(`${a.adsetId}\x00${entityLookupKey(a.name)}`, a.id);
    }
  }
  const adMap = new Map<string, string>();
  for (const r of rows) {
    if (!r.campaignName || !r.adsetName || !r.adName) continue;
    const cid = campaignMap.get(r.campaignName);
    if (!cid) continue;
    const asid = adsetMap.get(`${cid}\x00${r.adsetName}`);
    if (!asid) continue;
    const id = adIdByKey.get(`${asid}\x00${entityLookupKey(r.adName)}`);
    if (id) adMap.set(`${asid}\x00${r.adName}`, id);
  }

  return { campaignMap, adsetMap, adMap };
}

function resolveAdIds(
  row: {
    campaignName: string | null;
    adsetName: string | null;
    adName: string | null;
  },
  maps: {
    campaignMap: Map<string, string>;
    adsetMap: Map<string, string>;
    adMap: Map<string, string>;
  },
): {
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
} {
  if (!row.campaignName) return { campaignId: null, adsetId: null, adId: null };
  const campaignId = maps.campaignMap.get(row.campaignName) ?? null;
  if (!campaignId || !row.adsetName)
    return { campaignId, adsetId: null, adId: null };
  const adsetId = maps.adsetMap.get(`${campaignId}\x00${row.adsetName}`) ?? null;
  if (!adsetId || !row.adName) return { campaignId, adsetId, adId: null };
  const adId = maps.adMap.get(`${adsetId}\x00${row.adName}`) ?? null;
  return { campaignId, adsetId, adId };
}

async function upsertEmployee(
  fullName: string,
  fullNameNormalized: string,
  team: string | null,
): Promise<string> {
  const [emp] = await db
    .insert(employees)
    .values({
      fullName,
      fullNameNormalized,
      bitrixTeam: team,
      active: true,
    })
    .onConflictDoUpdate({
      target: employees.fullNameNormalized,
      set: { fullName, bitrixTeam: team },
    })
    .returning({ id: employees.id });
  return emp.id;
}

export async function ingestFacebookRows(
  rows: FacebookLeadInput[],
  ctx: UpsertContext,
): Promise<UpsertSummary> {
  const summary: UpsertSummary = {
    inserted: 0,
    updated: 0,
    conflicts: 0,
    pendingAliases: 0,
  };

  const adMaps = await buildAdTaxonomyMaps(ctx.projectId, rows);
  const aliasMap = await loadStageAliasMap();

  const incomingNames = [
    ...new Set(rows.map((r) => r.fullNameNormalized).filter(Boolean)),
  ];
  const candidates = await loadCandidates(ctx.projectId, incomingNames);
  const candidatesByName = new Map<string, LeadCandidate[]>();
  for (const c of candidates) {
    const arr = candidatesByName.get(c.fullNameNormalized) ?? [];
    arr.push(c);
    candidatesByName.set(c.fullNameNormalized, arr);
  }

  type InsertRow = typeof leads.$inferInsert;
  const toInsert: InsertRow[] = [];
  const toUpdate: Array<{
    id: string;
    set: Partial<typeof leads.$inferInsert>;
  }> = [];
  const conflictRows: Array<{
    csvUploadId: string;
    candidates: string[];
    reason: string;
  }> = [];

  const stageEvents: Array<{
    leadId: string;
    projectId: string;
    fromStageId: string | null;
    toStageId: string | null;
    source: "csv_facebook";
  }> = [];
  const pendingInsertStageEvents: Array<{ idx: number; stageId: string }> = [];

  for (const row of rows) {
    const ad = resolveAdIds(row, adMaps);
    const matchCandidates = candidatesByName.get(row.fullNameNormalized) ?? [];
    const match = matchLead(
      {
        fullNameNormalized: row.fullNameNormalized,
        phoneNormalized: row.phoneNormalized,
      },
      matchCandidates,
    );

    let stageId: string | null = null;
    if (row.rawStage) {
      const stageRes = resolveStage(row.rawStage, aliasMap);
      if (stageRes.kind === "matched") stageId = stageRes.stageId;
      else if (stageRes.kind === "pending" || stageRes.kind === "unknown") {
        summary.pendingAliases++;
      }
    }

    if (match.kind === "conflict") {
      conflictRows.push({
        csvUploadId: ctx.csvUploadId,
        candidates: match.candidateIds,
        reason: `Multiple leads cùng tên "${row.fullName}"; phone không xác định unique`,
      });
      summary.conflicts++;
      continue;
    }

    if (match.kind === "matched") {
      toUpdate.push({
        id: match.leadId,
        set: {
          phone: row.phone ?? undefined,
          phoneNormalized: row.phoneNormalized ?? undefined,
          email: row.email ?? undefined,
          fbLeadId: row.fbLeadId ?? undefined,
          campaignId: ad.campaignId,
          adsetId: ad.adsetId,
          adId: ad.adId,
          formName: row.formName,
          formAnswers: row.formAnswers,
          fbCreatedAt: row.fbCreatedAt,
          ...(stageId ? { currentStageId: stageId } : {}),
          updatedAt: new Date(),
        },
      });
      if (stageId) {
        stageEvents.push({
          leadId: match.leadId,
          projectId: ctx.projectId,
          fromStageId: null,
          toStageId: stageId,
          source: "csv_facebook",
        });
      }
      summary.updated++;
      continue;
    }

    const insertIdx = toInsert.length;
    toInsert.push({
      projectId: ctx.projectId,
      fullName: row.fullName,
      fullNameNormalized: row.fullNameNormalized,
      phone: row.phone,
      phoneNormalized: row.phoneNormalized,
      email: row.email,
      fbLeadId: row.fbLeadId,
      campaignId: ad.campaignId,
      adsetId: ad.adsetId,
      adId: ad.adId,
      formName: row.formName,
      formAnswers: row.formAnswers,
      fbCreatedAt: row.fbCreatedAt,
      currentStageId: stageId,
    });
    if (stageId) {
      pendingInsertStageEvents.push({ idx: insertIdx, stageId });
    }
    summary.inserted++;
  }

  const insertedIds: string[] = [];
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    if (chunk.length > 0) {
      const ret = await db
        .insert(leads)
        .values(chunk)
        .returning({ id: leads.id });
      for (const r of ret) insertedIds.push(r.id);
    }
  }
  for (const p of pendingInsertStageEvents) {
    const leadId = insertedIds[p.idx];
    if (leadId) {
      stageEvents.push({
        leadId,
        projectId: ctx.projectId,
        fromStageId: null,
        toStageId: p.stageId,
        source: "csv_facebook",
      });
    }
  }

  if (toUpdate.length > 0) {
    await db.transaction(async (tx) => {
      for (const u of toUpdate) {
        await tx.update(leads).set(u.set).where(eq(leads.id, u.id));
      }
    });
  }

  if (stageEvents.length > 0) {
    for (let i = 0; i < stageEvents.length; i += 500) {
      await db.insert(leadStageEvents).values(stageEvents.slice(i, i + 500));
    }
  }

  if (conflictRows.length > 0) {
    await db.insert(matchConflicts).values(conflictRows);
  }

  await aggregateAndUpsertMonthlySpend(rows, ctx.projectId);

  return summary;
}

export async function ingestCostRows(
  rows: Array<{ periodDate: string; amount: number }>,
  ctx: UpsertContext,
): Promise<UpsertSummary> {
  const summary: UpsertSummary = {
    inserted: 0,
    updated: 0,
    conflicts: 0,
    pendingAliases: 0,
  };
  if (rows.length > 0) {
    await db
      .insert(projectCosts)
      .values(
        rows.map((r) => ({
          projectId: ctx.projectId,
          periodDate: r.periodDate,
          amount: r.amount.toString(),
          source: "manual" as const,
        })),
      )
      .onConflictDoUpdate({
        target: [
          projectCosts.projectId,
          projectCosts.periodDate,
          projectCosts.source,
        ],
        set: { amount: sql`EXCLUDED.amount` },
      });
    summary.inserted = rows.length;
  }
  return summary;
}

async function aggregateAndUpsertMonthlySpend(
  rows: FacebookLeadInput[],
  projectId: string,
): Promise<void> {
  const monthMap = new Map<string, number>();
  for (const r of rows) {
    if (r.amountSpent == null || r.amountSpent <= 0) continue;
    if (!r.fbCreatedAt) continue;
    const d = r.fbCreatedAt;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}-01`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + r.amountSpent);
  }
  if (monthMap.size === 0) return;

  for (const [periodDate, total] of monthMap) {
    await db
      .insert(projectCosts)
      .values({
        projectId,
        periodDate,
        amount: String(total),
        source: "fb_api",
      })
      .onConflictDoUpdate({
        target: [
          projectCosts.projectId,
          projectCosts.periodDate,
          projectCosts.source,
        ],
        set: { amount: String(total) },
      });
  }
}

export async function ingestBitrixRows(
  rows: BitrixUpdateInput[],
  ctx: UpsertContext,
): Promise<UpsertSummary> {
  const summary: UpsertSummary = {
    inserted: 0,
    updated: 0,
    conflicts: 0,
    pendingAliases: 0,
  };

  const aliasMap = await loadStageAliasMap();
  const incomingNames = [
    ...new Set(rows.map((r) => r.fullNameNormalized).filter(Boolean)),
  ];
  const candidates = await loadCandidates(ctx.projectId, incomingNames);
  const candidatesByName = new Map<string, LeadCandidate[]>();
  for (const c of candidates) {
    const arr = candidatesByName.get(c.fullNameNormalized) ?? [];
    arr.push(c);
    candidatesByName.set(c.fullNameNormalized, arr);
  }

  const leadStageBefore = new Map<string, string | null>();
  if (candidates.length > 0) {
    const candidateIds = candidates.map((c) => c.id);
    const currentStages = await db
      .select({ id: leads.id, stageId: leads.currentStageId })
      .from(leads)
      .where(inArray(leads.id, candidateIds));
    for (const r of currentStages) {
      leadStageBefore.set(r.id, r.stageId);
    }
  }

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const stageRes = resolveStage(row.rawStage, aliasMap);
      let stageId: string | null = null;
      let needsReview = false;
      let reviewReason: string | null = null;

      if (stageRes.kind === "matched") {
        stageId = stageRes.stageId;
      } else if (stageRes.kind === "pending") {
        needsReview = true;
        reviewReason = `Stage "${stageRes.raw}" pending — admin chưa map alias`;
      } else if (stageRes.kind === "unknown") {
        await tx
          .insert(stageAliases)
          .values({ raw: stageRes.raw, stageId: null })
          .onConflictDoNothing();
        summary.pendingAliases++;
        needsReview = true;
        reviewReason = `Stage "${stageRes.raw}" mới — đã tạo alias pending`;
      }

      let employeeId: string | null = null;
      if (row.employeeName && row.employeeNameNormalized) {
        employeeId = await upsertEmployee(
          row.employeeName,
          row.employeeNameNormalized,
          row.employeeTeam,
        );
      }

      const matchCandidates = candidatesByName.get(row.fullNameNormalized) ?? [];
      const match = matchLead(
        {
          fullNameNormalized: row.fullNameNormalized,
          phoneNormalized: null,
        },
        matchCandidates,
      );

      if (match.kind === "conflict") {
        await tx.insert(matchConflicts).values({
          csvUploadId: ctx.csvUploadId,
          candidates: match.candidateIds,
          reason: `Bitrix update: nhiều lead cùng tên "${row.fullName}"`,
        });
        summary.conflicts++;
        continue;
      }

      if (match.kind === "matched") {
        const prevStageId = leadStageBefore.get(match.leadId) ?? null;
        await tx
          .update(leads)
          .set({
            currentStageId: stageId,
            currentEmployeeId: employeeId,
            bitrixUpdatedAt: row.bitrixUpdatedAt,
            lastComment: row.comment,
            needsReview,
            reviewReason,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, match.leadId));

        if (stageId !== prevStageId && (stageId !== null || prevStageId !== null)) {
          await tx.insert(leadStageEvents).values({
            leadId: match.leadId,
            projectId: ctx.projectId,
            fromStageId: prevStageId,
            toStageId: stageId,
            employeeId,
            source: "csv_bitrix",
          });
        }

        summary.updated++;
        continue;
      }

      await tx.insert(leads).values({
        projectId: ctx.projectId,
        fullName: row.fullName,
        fullNameNormalized: row.fullNameNormalized,
        currentStageId: stageId,
        currentEmployeeId: employeeId,
        bitrixUpdatedAt: row.bitrixUpdatedAt,
        lastComment: row.comment,
        needsReview: true,
        reviewReason: "Lead có trong Bitrix nhưng không tìm thấy trong Facebook",
      });
      summary.inserted++;
    }
  });

  return summary;
}

export async function snapshotLeadsForDate(
  projectId: string,
  date: Date,
): Promise<number> {
  const dateStr = date.toISOString().slice(0, 10);
  const result = await db.execute(sql`
    INSERT INTO lead_snapshots
      (snapshot_date, lead_id, project_id, stage_id, employee_id, fanpage_id, raw)
    SELECT
      ${dateStr}::date,
      id,
      project_id,
      current_stage_id,
      current_employee_id,
      fanpage_id,
      NULL
    FROM leads
    WHERE project_id = ${projectId}
    ON CONFLICT (snapshot_date, lead_id) DO UPDATE
    SET stage_id = EXCLUDED.stage_id,
        employee_id = EXCLUDED.employee_id
  `);
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
