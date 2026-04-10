import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  leads,
  leadStageEvents,
  leadSnapshots,
  campaigns,
  adsets,
  ads,
  employees,
  stages,
  stageAliases,
  matchConflicts,
  projectCosts,
} from "@/db/schema";
import { matchLead, type LeadCandidate } from "./matcher";
import { resolveStage } from "./stage-mapper";
import { entityLookupKey } from "@/lib/utils/unicode";
import type {
  FacebookLeadInput,
  BitrixUpdateInput,
} from "@/lib/adapters/lead-source";

/**
 * Upsert service — orchestrate toàn bộ flow ingest lead vào DB.
 *
 * Gọi từ Inngest function `process-csv-upload`. Nhận đã-parse DTO,
 * không quan tâm nguồn (CSV hay webhook).
 */

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

/**
 * Build alias map từ DB cho stage resolver.
 * Key = lowercase trim of alias raw (case-insensitive lookup).
 * Cũng thêm stage.code + stage.labelVi làm alias ngầm.
 */
async function loadStageAliasMap(): Promise<Map<string, string | null>> {
  const [aliasRows, stageRows] = await Promise.all([
    db.select().from(stageAliases),
    db.select().from(stages),
  ]);
  const map = new Map<string, string | null>();
  // Stages first: code + labelVi → id
  for (const s of stageRows) {
    map.set(entityLookupKey(s.code), s.id);
    map.set(entityLookupKey(s.labelVi), s.id);
  }
  // Explicit aliases override (or add pending null)
  for (const a of aliasRows) {
    map.set(entityLookupKey(a.raw), a.stageId);
  }
  return map;
}

/**
 * Lấy candidates trong project để matcher dùng.
 * Optimization: chỉ lấy lead có name match một trong các incoming names.
 */
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
  return rows.map(
    (r: {
      id: string;
      fullNameNormalized: string;
      phoneNormalized: string | null;
    }) => ({
      id: r.id,
      fullNameNormalized: r.fullNameNormalized,
      phoneNormalized: r.phoneNormalized,
    }),
  );
}

/**
 * Build ads taxonomy lookup map cho TẤT CẢ rows trong 1 batch.
 *
 * Thay vì 3 query/row × N rows = 3N queries, làm 6 queries tổng:
 * 1. Bulk insert distinct campaigns
 * 2. Select all campaigns by name (lấy id)
 * 3. Bulk insert distinct adsets
 * 4. Select adsets by (campaignId, name)
 * 5. Bulk insert distinct ads
 * 6. Select ads by (adsetId, name)
 *
 * Trả về 3 Map để tra cứu O(1) khi process từng row.
 */
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
  adsetMap: Map<string, string>; // key = `${campaignId}:${adsetName}`
  adMap: Map<string, string>; // key = `${adsetId}:${adName}`
}> {
  // Load ALL existing campaigns/adsets/ads for this project once.
  // Lookups during upsert are case-insensitive (entityLookupKey).
  const existingCampaigns = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.projectId, projectId));
  const campaignIdByNorm = new Map<string, string>();
  for (const c of existingCampaigns) {
    campaignIdByNorm.set(entityLookupKey(c.name), c.id);
  }

  // 1. Distinct incoming campaign names (preserve original casing for insert)
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
    // If onConflict skipped (race), re-fetch for any missing
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
  // campaignMap: original CSV string → campaign id (normalized lookup)
  const campaignMap = new Map<string, string>();
  for (const name of incomingCampaignNames) {
    const id = campaignIdByNorm.get(entityLookupKey(name));
    if (id) campaignMap.set(name, id);
  }

  // 2. Adsets — load existing for relevant campaigns, then insert missing
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
  const adsetIdByKey = new Map<string, string>(); // `${campaignId}\x00${normKey}` → id
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
  // adsetMap: original (campaignId, csvAdsetName) → id
  const adsetMap = new Map<string, string>();
  for (const r of rows) {
    if (!r.campaignName || !r.adsetName) continue;
    const cid = campaignMap.get(r.campaignName);
    if (!cid) continue;
    const id = adsetIdByKey.get(`${cid}\x00${entityLookupKey(r.adsetName)}`);
    if (id) adsetMap.set(`${cid}\x00${r.adsetName}`, id);
  }

  // 3. Ads — same pattern
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

/**
 * Lookup helper: trả về { campaignId, adsetId, adId } cho 1 row.
 */
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

/**
 * Upsert employee từ Responsible Bitrix → trả về employeeId.
 */
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

/**
 * Process Facebook CSV rows — INSERT lead nếu chưa có (hoặc update nếu match).
 * Stage để null vì FB không cung cấp — Bitrix CSV upload sau sẽ fill.
 */
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

  // Step 1: Build ads taxonomy maps (~6 queries cho cả batch)
  const adMaps = await buildAdTaxonomyMaps(ctx.projectId, rows);

  // Step 1b: Load stage alias map (case-insensitive) — for "Tình trạng" column
  const aliasMap = await loadStageAliasMap();

  // Step 2: Pre-load candidates cho tất cả tên (1 query)
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

  // Step 3: Phân loại từng row → toInsert / toUpdate / conflicts
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

  // Collect stage events for insert on both new + updated leads
  const stageEvents: Array<{
    leadId: string;
    projectId: string;
    fromStageId: string | null;
    toStageId: string | null;
    source: "csv_facebook";
  }> = [];
  // For toInsert we don't know leadId yet — defer via marker index
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

    // Resolve stage from "Tình trạng" column if present
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
      // Record stage change event (best-effort: we don't pre-load prev stage,
      // always write event when FB brings a stage). Consumers can dedupe.
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

    // no-match → bulk insert
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

  // Step 4: Bulk INSERT with RETURNING id (so we can attach stage events)
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
  // Attach stage events for newly-inserted leads with a stage
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

  // Step 5: Updates (vẫn per-row vì set khác nhau, nhưng số ít)
  for (const u of toUpdate) {
    await db.update(leads).set(u.set).where(eq(leads.id, u.id));
  }

  // Step 5b: Bulk insert stage events
  if (stageEvents.length > 0) {
    for (let i = 0; i < stageEvents.length; i += 500) {
      await db.insert(leadStageEvents).values(stageEvents.slice(i, i + 500));
    }
  }

  // Step 6: Bulk insert conflicts
  if (conflictRows.length > 0) {
    await db.insert(matchConflicts).values(conflictRows);
  }

  // Step 7: Aggregate monthly spend from rows có amountSpent (Option A).
  // Chỉ chạy khi có ít nhất 1 row có spend — guard để không đụng project_costs
  // khi file FB Leads thuần (không có cột Insights).
  await aggregateAndUpsertMonthlySpend(rows, ctx.projectId);

  return summary;
}

/**
 * Ingest cost CSV (BC NGÂN SÁCH) — upsert daily rows vào project_costs
 * với source='manual'. Idempotent qua unique (projectId, periodDate, source).
 */
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
  for (const r of rows) {
    const result = await db
      .insert(projectCosts)
      .values({
        projectId: ctx.projectId,
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
    if (result.length > 0) summary.inserted++;
  }
  return summary;
}

/**
 * Build map<yearMonth, total> từ rows có amountSpent, rồi upsert vào project_costs.
 * Dùng source='fb_api' (enum hiện tại không có 'csv' — coi spend CSV như
 * snapshot từ FB Insights).
 */
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

/**
 * Process Bitrix CSV rows — UPDATE stage + employee cho leads có sẵn từ FB.
 * Nếu lead chưa có (Bitrix có mà FB không) → INSERT lead với needs_review.
 */
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

  // Track stages cũ để detect change → ghi event
  const leadStageBefore = new Map<string, string | null>();
  if (candidates.length > 0) {
    const candidateIds = candidates.map((c) => c.id);
    const currentStages = await db
      .select({ id: leads.id, stageId: leads.currentStageId })
      .from(leads)
      .where(inArray(leads.id, candidateIds));
    for (const r of currentStages as Array<{
      id: string;
      stageId: string | null;
    }>) {
      leadStageBefore.set(r.id, r.stageId);
    }
  }

  for (const row of rows) {
    // Resolve stage
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
      // Tạo alias mới với stageId=null để admin map sau
      await db
        .insert(stageAliases)
        .values({ raw: stageRes.raw, stageId: null })
        .onConflictDoNothing();
      summary.pendingAliases++;
      needsReview = true;
      reviewReason = `Stage "${stageRes.raw}" mới — đã tạo alias pending`;
    }

    // Upsert employee
    let employeeId: string | null = null;
    if (row.employeeName && row.employeeNameNormalized) {
      employeeId = await upsertEmployee(
        row.employeeName,
        row.employeeNameNormalized,
        row.employeeTeam,
      );
    }

    // Match
    const matchCandidates = candidatesByName.get(row.fullNameNormalized) ?? [];
    const match = matchLead(
      {
        fullNameNormalized: row.fullNameNormalized,
        phoneNormalized: null, // Bitrix không có phone trong sample
      },
      matchCandidates,
    );

    if (match.kind === "conflict") {
      await db.insert(matchConflicts).values({
        csvUploadId: ctx.csvUploadId,
        candidates: match.candidateIds,
        reason: `Bitrix update: nhiều lead cùng tên "${row.fullName}"`,
      });
      summary.conflicts++;
      continue;
    }

    if (match.kind === "matched") {
      const prevStageId = leadStageBefore.get(match.leadId) ?? null;
      await db
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

      // Stage event nếu có thay đổi
      if (stageId !== prevStageId && (stageId !== null || prevStageId !== null)) {
        await db.insert(leadStageEvents).values({
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

    // no-match → Bitrix có lead mà FB không → INSERT với flag
    await db.insert(leads).values({
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

  return summary;
}

/**
 * Daily snapshot helper — copy current state của tất cả lead trong project
 * (đã update hôm nay) vào lead_snapshots.
 * Idempotent qua unique (snapshot_date, lead_id).
 */
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
  // Drizzle execute trả về result với rowCount
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
