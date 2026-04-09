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
} from "@/db/schema";
import { matchLead, type LeadCandidate } from "./matcher";
import { resolveStage } from "./stage-mapper";
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
 */
async function loadStageAliasMap(): Promise<Map<string, string | null>> {
  const rows = await db.select().from(stageAliases);
  return new Map(
    rows.map((r: { raw: string; stageId: string | null }) => [
      r.raw,
      r.stageId,
    ]),
  );
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
  // 1. Distinct campaigns
  const campaignNames = [
    ...new Set(rows.map((r) => r.campaignName).filter((n): n is string => !!n)),
  ];

  if (campaignNames.length > 0) {
    await db
      .insert(campaigns)
      .values(
        campaignNames.map((name) => ({
          projectId,
          name,
          statusLabel: "on" as const,
        })),
      )
      .onConflictDoNothing();
  }

  const campaignRows =
    campaignNames.length > 0
      ? await db
          .select({ id: campaigns.id, name: campaigns.name })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.projectId, projectId),
              inArray(campaigns.name, campaignNames),
            ),
          )
      : [];
  const campaignMap = new Map<string, string>(
    campaignRows.map((c: { id: string; name: string }) => [c.name, c.id]),
  );

  // 2. Distinct (campaignName, adsetName) pairs
  const adsetPairs = new Set<string>();
  for (const r of rows) {
    if (r.campaignName && r.adsetName) {
      adsetPairs.add(`${r.campaignName}\x00${r.adsetName}`);
    }
  }
  const adsetTuples = [...adsetPairs]
    .map((p) => {
      const [cn, an] = p.split("\x00");
      const cid = campaignMap.get(cn);
      return cid ? { campaignId: cid, name: an } : null;
    })
    .filter((x): x is { campaignId: string; name: string } => x !== null);

  if (adsetTuples.length > 0) {
    await db.insert(adsets).values(adsetTuples).onConflictDoNothing();
  }

  const distinctCampaignIds = [
    ...new Set(adsetTuples.map((a) => a.campaignId)),
  ];
  const adsetRows =
    distinctCampaignIds.length > 0
      ? await db
          .select({
            id: adsets.id,
            campaignId: adsets.campaignId,
            name: adsets.name,
          })
          .from(adsets)
          .where(inArray(adsets.campaignId, distinctCampaignIds))
      : [];
  const adsetMap = new Map<string, string>(
    adsetRows.map((a: { id: string; campaignId: string; name: string }) => [
      `${a.campaignId}\x00${a.name}`,
      a.id,
    ]),
  );

  // 3. Distinct (adsetId, adName) — key bằng adsetId thay vì adsetName
  const adTuples: Array<{
    adsetId: string;
    projectId: string;
    name: string;
    formName: string | null;
  }> = [];
  for (const r of rows) {
    if (r.campaignName && r.adsetName && r.adName) {
      const cid = campaignMap.get(r.campaignName);
      if (!cid) continue;
      const adsetId = adsetMap.get(`${cid}\x00${r.adsetName}`);
      if (!adsetId) continue;
      adTuples.push({
        adsetId,
        projectId,
        name: r.adName,
        formName: r.formName,
      });
    }
  }

  // Dedupe ad tuples theo (adsetId, name)
  const adSeen = new Set<string>();
  const adUnique = adTuples.filter((a) => {
    const k = `${a.adsetId}\x00${a.name}`;
    if (adSeen.has(k)) return false;
    adSeen.add(k);
    return true;
  });

  if (adUnique.length > 0) {
    await db.insert(ads).values(adUnique).onConflictDoNothing();
  }

  const distinctAdsetIds = [...new Set(adUnique.map((a) => a.adsetId))];
  const adRows =
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
  const adMap = new Map<string, string>(
    adRows.map((a: { id: string; adsetId: string; name: string }) => [
      `${a.adsetId}\x00${a.name}`,
      a.id,
    ]),
  );

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
          updatedAt: new Date(),
        },
      });
      summary.updated++;
      continue;
    }

    // no-match → bulk insert
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
    });
    summary.inserted++;
  }

  // Step 4: Bulk INSERT (Postgres limit ~65k params/query → chunk 500 rows)
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    if (chunk.length > 0) {
      await db.insert(leads).values(chunk);
    }
  }

  // Step 5: Updates (vẫn per-row vì set khác nhau, nhưng số ít)
  for (const u of toUpdate) {
    await db.update(leads).set(u.set).where(eq(leads.id, u.id));
  }

  // Step 6: Bulk insert conflicts
  if (conflictRows.length > 0) {
    await db.insert(matchConflicts).values(conflictRows);
  }

  return summary;
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
      to_jsonb(leads.*)
    FROM leads
    WHERE project_id = ${projectId}
    ON CONFLICT (snapshot_date, lead_id) DO UPDATE
    SET raw = EXCLUDED.raw,
        stage_id = EXCLUDED.stage_id,
        employee_id = EXCLUDED.employee_id
  `);
  // Drizzle execute trả về result với rowCount
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
