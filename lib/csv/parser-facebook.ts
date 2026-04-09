import Papa from "papaparse";
import { normalizeName, normalizePhone } from "@/lib/utils/unicode";

/**
 * Parser CSV xuất từ Facebook Ads Manager (Lead Ads).
 *
 * Cấu trúc cố định 11 cột đầu + N custom form fields tuỳ form.
 * KHÔNG dùng cột "Tình trạng" — stage thực lấy từ Bitrix CSV upload riêng.
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

const FB_KNOWN_COLUMNS = new Set<string>([
  ...FB_REQUIRED_HEADERS,
  "Tình trạng", // ignored — stage lấy từ Bitrix
]);

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
      campaignName: row["Campaign"]?.trim() || null,
      adsetName: row["Adset"]?.trim() || null,
      adName: row["Ad"]?.trim() || null,
      formName: row["Form Name"]?.trim() || null,
      fbCreatedAt: parseVnDate(row["Created Time"]),
      formAnswers,
    };
  });

  return { kind: "ok", rows };
}
