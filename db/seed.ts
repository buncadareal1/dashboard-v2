/**
 * Seed: 16 stages chuẩn + sample stage_aliases + sources + 1 admin user.
 *
 * Run: npx dotenv -e .env.local -- npx tsx db/seed.ts
 */
import { db } from "./index";
import { stages, stageAliases, sources, users } from "./schema";
import { normalizeName } from "@/lib/utils/unicode";

const STAGES = [
  // category 'new'
  { code: "NEW", labelVi: "New", category: "new" as const, color: "#94a3b8", displayOrder: 10 },
  { code: "DATA_THO", labelVi: "Data thô", category: "new" as const, color: "#cbd5e1", displayOrder: 20 },
  { code: "FLASH", labelVi: "Flash", category: "new" as const, color: "#fbbf24", displayOrder: 30 },
  { code: "MKT_CU", labelVi: "MKT Cũ", category: "new" as const, color: "#94a3b8", displayOrder: 40 },

  // category 'nurturing'
  { code: "DANG_CHAM", labelVi: "Đang Chăm (2h)", category: "nurturing" as const, color: "#f97316", displayOrder: 110 },
  { code: "F1", labelVi: "F1 (Quan tâm dự án)", category: "nurturing" as const, color: "#ef4444", displayOrder: 120 },
  { code: "SALE_PHONE", labelVi: "Sale phone", category: "nurturing" as const, color: "#a855f7", displayOrder: 130 },

  // category 'converted'
  { code: "BOOKING", labelVi: "Booking", category: "converted" as const, color: "#22c55e", displayOrder: 200 },
  { code: "DA_MUA", labelVi: "Đã mua", category: "converted" as const, color: "#16a34a", displayOrder: 210 },

  // category 'dead'
  { code: "KHONG_SDT", labelVi: "Không SĐT", category: "dead" as const, color: "#71717a", displayOrder: 300 },
  { code: "KHONG_BAT_MAY", labelVi: "Không Bắt Máy", category: "dead" as const, color: "#71717a", displayOrder: 310 },
  { code: "THUE_BAO_KLL", labelVi: "Thuê bao KLL được", category: "dead" as const, color: "#52525b", displayOrder: 320 },
  { code: "CHAO_DA_KHAC", labelVi: "Chào dự án khác", category: "dead" as const, color: "#0ea5e9", displayOrder: 330 },
  { code: "MOI_GIOI", labelVi: "Môi giới", category: "dead" as const, color: "#3b82f6", displayOrder: 340 },
  { code: "SPAM_LEAD", labelVi: "Spam Lead", category: "dead" as const, color: "#dc2626", displayOrder: 350 },
];

/**
 * Sample mapping raw string Bitrix → stage code.
 * Admin có thể thêm alias mới qua UI mà không cần deploy.
 * Format: { raw: "F1 (QT dự án cụ thể)", code: "F1" }
 */
const SAMPLE_ALIASES: Array<{ raw: string; code: string }> = [
  { raw: "New", code: "NEW" },
  { raw: "Đang Chăm", code: "DANG_CHAM" },
  { raw: "Đang Chăm (2h)", code: "DANG_CHAM" },
  { raw: "F1", code: "F1" },
  { raw: "F1 (QT dự án cụ thể)", code: "F1" },
  { raw: "F1 (Quan tâm DA)", code: "F1" },
  { raw: "Booking", code: "BOOKING" },
  { raw: "Đã mua", code: "DA_MUA" },
  { raw: "Deal", code: "DA_MUA" },
  { raw: "Không SĐT", code: "KHONG_SDT" },
  { raw: "Không Bắt Máy", code: "KHONG_BAT_MAY" },
  { raw: "Thuê bao KLL được", code: "THUE_BAO_KLL" },
  { raw: "Chào dự án khác", code: "CHAO_DA_KHAC" },
  { raw: "Môi giới", code: "MOI_GIOI" },
  { raw: "Spam Lead", code: "SPAM_LEAD" },
  { raw: "Sale phone", code: "SALE_PHONE" },
  { raw: "Data thô", code: "DATA_THO" },
  { raw: "Flash", code: "FLASH" },
  { raw: "MKT Cũ", code: "MKT_CU" },
];

const SOURCES = [
  "Facebook",
  "Google",
  "Zalo",
  "TikTok",
  "YouTube",
  "Webform",
  "Hotline",
  "Email MKT",
  "Data MKT",
];

async function seed() {
  console.log("🌱 Seeding stages...");
  await db.insert(stages).values(STAGES).onConflictDoNothing();

  console.log("🌱 Seeding stage_aliases...");
  const allStages = await db.query.stages.findMany();
  const codeToId = new Map(
    allStages.map((s: { code: string; id: string }) => [s.code, s.id]),
  );

  const aliasRows = SAMPLE_ALIASES.map((a) => ({
    raw: a.raw,
    stageId: codeToId.get(a.code) ?? null,
  }));
  await db.insert(stageAliases).values(aliasRows).onConflictDoNothing();

  console.log("🌱 Seeding sources...");
  await db
    .insert(sources)
    .values(SOURCES.map((name) => ({ name })))
    .onConflictDoNothing();

  // Admin user mẫu — đổi email thành email công ty thật trước khi login lần đầu
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@company.com";
  console.log(`🌱 Seeding admin user (${adminEmail})...`);
  await db
    .insert(users)
    .values({
      name: "Admin",
      email: adminEmail.toLowerCase(),
      role: "admin",
      active: true,
    })
    .onConflictDoNothing();

  console.log("✅ Seed complete");

  // Suppress unused warning for normalizeName (sẽ dùng ở Phase 2)
  void normalizeName;
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
