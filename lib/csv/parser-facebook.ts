import Papa from "papaparse";
import {
  normalizeName,
  normalizePhone,
  normalizeEntityName,
} from "@/lib/utils/unicode";

/**
 * Parser CSV xuất từ Facebook Ads Manager (Lead Ads).
 *
 * Cấu trúc cố định 11 cột đầu + N custom form fields tuỳ form.
 * Cột "Tình trạng" nếu có → parse luôn làm stage. Bitrix CSV upload
 * sau này chỉ cập nhật/override stage cho các lead đã tồn tại.
 */

export const FB_REQUIRED_HEADERS = [
  "Created Time",
  "DATE CLEAN",
  "Full Name",
  "Phone",
  "Email",
  "Campaign",
  "Adset",
  "Ad",
  "Form Name",
  "Lead ID",
] as const;

/**
 * Optional "amount spent" columns — FB Ads Manager Insights export đôi khi có.
 * Guarded: nếu file không có thì formAnswers vẫn giữ nguyên, spend = null.
 */
const FB_SPENT_HEADERS = [
  "Amount spent (VND)",
  "Amount spent",
  "Số tiền đã chi tiêu (VND)",
  "Số tiền đã chi tiêu",
  "Spend",
] as const;

/** Optional stage column in FB CSV exports (user may include) */
const FB_STAGE_HEADERS = ["Tình trạng", "Stage", "Trạng thái"] as const;

const FB_KNOWN_COLUMNS = new Set<string>([
  ...FB_REQUIRED_HEADERS,
  ...FB_SPENT_HEADERS,
  ...FB_STAGE_HEADERS,
]);

function parseSpentNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  // Strip thousands separator (. or ,) — keep decimals ambiguous; FB VND = integer
  const cleaned = raw.replace(/[^\d.-]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export type FacebookRow = {
  fullName: string;
  fullNameNormalized: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  fbLeadId: string | null;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
  formName: string | null;
  fbCreatedAt: Date | null;
  /** Amount spent (VND) từ cột Insights nếu có — null nếu file không chứa */
  amountSpent: number | null;
  /** Raw stage label từ cột "Tình trạng" nếu có — resolve qua alias map */
  rawStage: string | null;
  /** Custom form fields — dynamic key set per form */
  formAnswers: Record<string, string>;
};

export type ParseFbResult =
  | { kind: "ok"; rows: FacebookRow[] }
  | { kind: "invalid-header"; missing: string[] }
  | { kind: "parse-error"; error: string };

/**
 * Parse "DD/MM/YYYY" hoặc "DD/MM/YYYY HH:mm" → UTC Date.
 * Chuẩn hoá về Asia/Ho_Chi_Minh không cần — Date object là UTC nội bộ.
 */
function parseVnDate(input: string | undefined | null): Date | null {
  if (!input) return null;
  const match = input.trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/,
  );
  if (!match) return null;
  const [, dd, mm, yyyy, hh = "0", mi = "0"] = match;
  const d = new Date(
    Date.UTC(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      parseInt(hh, 10),
      parseInt(mi, 10),
    ),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseFacebookCsv(input: string): ParseFbResult {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return { kind: "parse-error", error: parsed.errors[0].message };
  }

  const headers = parsed.meta.fields ?? [];
  const missing = FB_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { kind: "invalid-header", missing: [...missing] };
  }

  // Detect which spent column is present (ưu tiên thứ tự trong FB_SPENT_HEADERS)
  const spentCol = FB_SPENT_HEADERS.find((h) => headers.includes(h)) ?? null;
  // Detect stage column
  const stageCol = FB_STAGE_HEADERS.find((h) => headers.includes(h)) ?? null;

  const rows: FacebookRow[] = parsed.data.map((row) => {
    const fullName = row["Full Name"]?.trim() ?? "";
    const phone = row["Phone"]?.trim() || null;
    const email = row["Email"]?.trim() || null;

    // Custom form fields = mọi cột không thuộc FB_KNOWN_COLUMNS
    const formAnswers: Record<string, string> = {};
    for (const key of headers) {
      if (FB_KNOWN_COLUMNS.has(key)) continue;
      const v = row[key]?.trim();
      if (v) formAnswers[key] = v;
    }

    return {
      fullName,
      fullNameNormalized: normalizeName(fullName),
      phone,
      phoneNormalized: phone ? normalizePhone(phone) : null,
      email,
      fbLeadId: row["Lead ID"]?.trim() || null,
      campaignName: normalizeEntityName(row["Campaign"]) || null,
      adsetName: normalizeEntityName(row["Adset"]) || null,
      adName: normalizeEntityName(row["Ad"]) || null,
      formName: normalizeEntityName(row["Form Name"]) || null,
      fbCreatedAt: parseVnDate(row["Created Time"]),
      amountSpent: spentCol ? parseSpentNumber(row[spentCol]) : null,
      rawStage: stageCol ? (row[stageCol]?.trim() || null) : null,
      formAnswers,
    };
  });

  return { kind: "ok", rows };
}
