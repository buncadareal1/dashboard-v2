import Papa from "papaparse";
import { normalizeName } from "@/lib/utils/unicode";

/**
 * Parser CSV Bitrix (do user tự chuyển từ ảnh export Bitrix24).
 *
 * Format cố định: Lead, Stage, Responsible, Updated Time, Comment
 * Responsible = "Tên nhân viên - Team" (Juno/Neptune/Aura/Virgo).
 * Stage = raw string, sẽ resolve qua stage_aliases bên upsert service.
 */

export const BITRIX_REQUIRED_HEADERS = [
  "Lead",
  "Stage",
  "Responsible",
  "Updated Time",
] as const;

export type BitrixRow = {
  fullName: string;
  fullNameNormalized: string;
  rawStage: string | null;
  employeeName: string | null;
  employeeNameNormalized: string | null;
  employeeTeam: string | null;
  bitrixUpdatedAt: Date | null;
  comment: string | null;
};

export type ParseBitrixResult =
  | { kind: "ok"; rows: BitrixRow[] }
  | { kind: "invalid-header"; missing: string[] }
  | { kind: "parse-error"; error: string };

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

/**
 * Tách "Tên - Team" thành { name, team }.
 * Không có "-" → team = null.
 */
function parseResponsible(raw: string | null): {
  name: string | null;
  team: string | null;
} {
  if (!raw) return { name: null, team: null };
  const trimmed = raw.trim();
  const lastDash = trimmed.lastIndexOf(" - ");
  if (lastDash === -1) return { name: trimmed, team: null };
  return {
    name: trimmed.slice(0, lastDash).trim(),
    team: trimmed.slice(lastDash + 3).trim() || null,
  };
}

export function parseBitrixCsv(input: string): ParseBitrixResult {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return { kind: "parse-error", error: parsed.errors[0].message };
  }

  const headers = parsed.meta.fields ?? [];
  const missing = BITRIX_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { kind: "invalid-header", missing: [...missing] };
  }

  const rows: BitrixRow[] = parsed.data.map((row) => {
    const fullName = row["Lead"]?.trim() ?? "";
    const responsible = parseResponsible(row["Responsible"] ?? null);
    return {
      fullName,
      fullNameNormalized: normalizeName(fullName),
      rawStage: row["Stage"]?.trim() || null,
      employeeName: responsible.name,
      employeeNameNormalized: responsible.name
        ? normalizeName(responsible.name)
        : null,
      employeeTeam: responsible.team,
      bitrixUpdatedAt: parseVnDate(row["Updated Time"]),
      comment: row["Comment"]?.trim() || null,
    };
  });

  return { kind: "ok", rows };
}
