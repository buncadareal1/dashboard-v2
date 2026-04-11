import Papa from "papaparse";
import {
  normalizeName,
  normalizePhone,
  normalizeEntityName,
} from "../utils/unicode.js";

/**
 * Parser CSV xuất từ Facebook Ads Manager (Lead Ads).
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

const FB_SPENT_HEADERS = [
  "Amount spent (VND)",
  "Amount spent",
  "Số tiền đã chi tiêu (VND)",
  "Số tiền đã chi tiêu",
  "Spend",
] as const;

const FB_STAGE_HEADERS = ["Tình trạng", "Stage", "Trạng thái"] as const;

const FB_KNOWN_COLUMNS = new Set<string>([
  ...FB_REQUIRED_HEADERS,
  ...FB_SPENT_HEADERS,
  ...FB_STAGE_HEADERS,
]);

function parseSpentNumber(raw: string | undefined): number | null {
  if (!raw) return null;
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
  amountSpent: number | null;
  rawStage: string | null;
  formAnswers: Record<string, string>;
};

export type ParseFbResult =
  | { kind: "ok"; rows: FacebookRow[] }
  | { kind: "invalid-header"; missing: string[] }
  | { kind: "parse-error"; error: string };

function parseVnDate(input: string | undefined | null): Date | null {
  if (!input) return null;
  const match = input
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
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
  const text = input.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(text, {
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

  const spentCol = FB_SPENT_HEADERS.find((h) => headers.includes(h)) ?? null;
  const stageCol = FB_STAGE_HEADERS.find((h) => headers.includes(h)) ?? null;

  const rows: FacebookRow[] = parsed.data.map((row) => {
    const fullName = row["Full Name"]?.trim() ?? "";
    const phone = row["Phone"]?.trim() || null;
    const email = row["Email"]?.trim() || null;

    const formAnswers: Record<string, string> = {};
    for (const key of headers) {
      if (!FB_KNOWN_COLUMNS.has(key) && row[key]?.trim()) {
        formAnswers[key] = row[key].trim();
      }
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
