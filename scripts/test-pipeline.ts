/**
 * Integration test Phase 2 pipeline với DB thật.
 *
 * Run:
 *   npx dotenv -e .env.local -- npx tsx scripts/test-pipeline.ts
 *
 * Steps:
 * 1. Tạo project test (cleanup nếu đã có)
 * 2. Read CSV Facebook + Bitrix fixtures
 * 3. Call ingest functions trực tiếp
 * 4. Query verify: leads, match_conflicts, stage_aliases, daily_aggregates
 * 5. Print summary
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  projects,
  projectUsers,
  leads,
  matchConflicts,
  stageAliases,
  dailyAggregates,
  stages,
  employees,
} from "../db/schema";
import { parseFacebookCsv } from "../lib/csv/parser-facebook";
import { parseBitrixCsv } from "../lib/csv/parser-bitrix";
import {
  ingestFacebookRows,
  ingestBitrixRows,
} from "../lib/csv/upsert-service";
import { rebuildAllAggregatesForProject } from "../lib/aggregates/builder";

const TEST_PROJECT_SLUG = "sun-ha-nam-thap-tang-test";

async function main() {
  console.log("🧪 Phase 2 integration test\n");

  // 1. Get admin user (đã seed)
  const admin = await db.query.users.findFirst({
    where: eq(users.role, "admin"),
  });
  if (!admin) {
    throw new Error(
      "Không tìm thấy admin user. Chạy `npm run db:seed` trước, hoặc đã đổi email admin chưa?",
    );
  }
  console.log(`✓ Found admin: ${admin.email}`);

  // 2. Cleanup project test cũ + create mới
  console.log(`\n🧹 Cleanup project test "${TEST_PROJECT_SLUG}"...`);
  const existing = await db.query.projects.findFirst({
    where: eq(projects.slug, TEST_PROJECT_SLUG),
  });
  if (existing) {
    await db.delete(projects).where(eq(projects.id, existing.id));
    console.log(`  → deleted old project ${existing.id}`);
  }

  const [project] = await db
    .insert(projects)
    .values({
      name: "SUN Hà Nam Thấp Tầng (TEST)",
      slug: TEST_PROJECT_SLUG,
      location: "Hà Nam",
      budget: "850000000",
      status: "running",
      createdBy: admin.id,
    })
    .returning();
  console.log(`✓ Created project: ${project.id}`);

  await db.insert(projectUsers).values({
    projectId: project.id,
    userId: admin.id,
    canView: true,
    canEdit: true,
    roleInProject: "digital",
  });
  console.log(`✓ Granted admin can_edit on project`);

  // 3. Read fixtures
  const fbPath =
    "/home/docdang/Downloads/_THẤP TẦNG SUN HÀ NAM - ÁI LINH - RAW_LEAD (3).csv";
  const bitrixPath = path.resolve(
    process.cwd(),
    "test-fixtures/bitrix-sample.csv",
  );

  let fbCsv: string;
  try {
    fbCsv = readFileSync(fbPath, "utf-8");
    console.log(`✓ Loaded FB CSV: ${fbCsv.length} bytes`);
  } catch {
    console.log(`⚠ FB CSV không có ở ${fbPath}, skip FB ingest`);
    fbCsv = "";
  }

  const bitrixCsv = readFileSync(bitrixPath, "utf-8");
  console.log(`✓ Loaded Bitrix fixture: ${bitrixCsv.length} bytes`);

  // 4. Ingest Facebook
  if (fbCsv) {
    console.log("\n📥 Ingest Facebook CSV...");
    const fbParsed = parseFacebookCsv(fbCsv);
    if (fbParsed.kind !== "ok") {
      throw new Error(`FB parse failed: ${fbParsed.kind}`);
    }
    console.log(`  → parsed ${fbParsed.rows.length} rows`);

    const fakeUploadId = (
      await db
        .insert(
          (await import("../db/schema")).csvUploads,
        )
        .values({
          uploadedBy: admin.id,
          projectId: project.id,
          type: "facebook",
          filename: "fb-test.csv",
          status: "processing",
        })
        .returning({ id: (await import("../db/schema")).csvUploads.id })
    )[0].id;

    const fbSummary = await ingestFacebookRows(
      fbParsed.rows.map((r) => ({ ...r, source: "csv_facebook" as const })),
      { projectId: project.id, csvUploadId: fakeUploadId },
    );
    console.log(`  ✓ FB ingest:`, fbSummary);
  }

  // 5. Ingest Bitrix
  console.log("\n📥 Ingest Bitrix CSV...");
  const bitrixParsed = parseBitrixCsv(bitrixCsv);
  if (bitrixParsed.kind !== "ok") {
    throw new Error(`Bitrix parse failed: ${bitrixParsed.kind}`);
  }
  console.log(`  → parsed ${bitrixParsed.rows.length} rows`);

  const bitrixUploadId = (
    await db
      .insert((await import("../db/schema")).csvUploads)
      .values({
        uploadedBy: admin.id,
        projectId: project.id,
        type: "bitrix",
        filename: "bitrix-test.csv",
        status: "processing",
      })
      .returning({ id: (await import("../db/schema")).csvUploads.id })
  )[0].id;

  const bitrixSummary = await ingestBitrixRows(
    bitrixParsed.rows.map((r) => ({ ...r, source: "csv_bitrix" as const })),
    { projectId: project.id, csvUploadId: bitrixUploadId },
  );
  console.log(`  ✓ Bitrix ingest:`, bitrixSummary);

  // 6. Rebuild aggregates
  console.log("\n📊 Rebuild daily aggregates (all dates)...");
  const aggResult = await rebuildAllAggregatesForProject(project.id);
  console.log(`  ✓ ${aggResult.rowsBuilt} aggregate rows built`);

  // 7. Verify
  console.log("\n🔍 Verification:\n");

  const totalLeads = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.projectId, project.id));
  console.log(`  Total leads in project:    ${totalLeads[0].count}`);

  const leadsWithStage = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.projectId, project.id),
        sql`${leads.currentStageId} IS NOT NULL`,
      ),
    );
  console.log(`  Leads with stage (matched):${leadsWithStage[0].count}`);

  const needsReview = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(eq(leads.projectId, project.id), eq(leads.needsReview, true)),
    );
  console.log(`  Leads needsReview:         ${needsReview[0].count}`);

  const conflictRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchConflicts);
  console.log(`  Match conflicts:           ${conflictRows[0].count}`);

  const pendingAliases = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stageAliases)
    .where(sql`${stageAliases.stageId} IS NULL`);
  console.log(`  Pending stage aliases:     ${pendingAliases[0].count}`);

  const employeesCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees);
  console.log(`  Employees inserted:        ${employeesCount[0].count}`);

  const aggregatesCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dailyAggregates)
    .where(eq(dailyAggregates.projectId, project.id));
  console.log(`  Daily aggregate rows:      ${aggregatesCount[0].count}`);

  // 8. Spot check: Cơ Điện Đan Phượng
  const spotCheck = await db.query.leads.findFirst({
    where: and(
      eq(leads.projectId, project.id),
      eq(leads.fullNameNormalized, "co dien dan phuong"),
    ),
    with: {} as never,
  });

  console.log("\n  Spot check 'Cơ Điện Đan Phượng':");
  if (spotCheck) {
    console.log(`    fullName:        ${spotCheck.fullName}`);
    console.log(`    phone:           ${spotCheck.phone}`);
    console.log(`    phoneNormalized: ${spotCheck.phoneNormalized}`);
    console.log(`    currentStageId:  ${spotCheck.currentStageId ?? "null"}`);
    console.log(
      `    employeeId:      ${spotCheck.currentEmployeeId ?? "null"}`,
    );
    console.log(`    fbCreatedAt:     ${spotCheck.fbCreatedAt?.toISOString()}`);
    console.log(`    bitrixUpdated:   ${spotCheck.bitrixUpdatedAt?.toISOString()}`);

    if (spotCheck.currentStageId) {
      const stage = await db.query.stages.findFirst({
        where: eq(stages.id, spotCheck.currentStageId),
      });
      console.log(`    stage label:     ${stage?.labelVi}`);
    }
  } else {
    console.log(`    ❌ NOT FOUND`);
  }

  console.log("\n✅ Pipeline test complete\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Pipeline test failed:");
  console.error(err);
  process.exit(1);
});
