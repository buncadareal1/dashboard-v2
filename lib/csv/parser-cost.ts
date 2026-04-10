/**
 * Parser CSV chi phí (BC NGÂN SÁCH) — định dạng thủ công Digital team dùng.
 *
 * Cấu trúc:
 *   STT,NGÀY,CHI TIÊU,LEAD,F1,...
 *   1,05/02/2026,"2.270.065 đ",8,4,...
 *
 * Chỉ quan tâm 2 cột: NGÀY (dd/MM/yyyy) + CHI TIÊU (format "1.234.567 đ").
 * Bỏ qua các dòng không có ngày hoặc số tiền = 0.
 *
 * Xử lý CSV multi-line (cells có newline trong quotes).
 */

export type CostRow = {
  periodDate: string; // YYYY-MM-DD
  amount: number; // VND integer
};

export type ParseCostResult =
  | { kind: "ok"; rows: CostRow[] }
  | { kind: "invalid-header"; missing: string[] }
  | { kind: "parse-error"; error: string };

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
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

/** Split text vào dòng, tôn trọng newline trong quoted cells */
function splitLinesRespectingQuotes(text: string): string[] {
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

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDateDMY(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parseCostCsv(input: string): ParseCostResult {
  const text = input.replace(/^\uFEFF/, "");
  const lines = splitLinesRespectingQuotes(text);
  if (lines.length < 2) {
    return { kind: "parse-error", error: "File trống hoặc thiếu dòng dữ liệu" };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toUpperCase());
  const dateIdx = header.findIndex((h) => h === "NGÀY" || h === "NGAY");
  const costIdx = header.findIndex(
    (h) => h === "CHI TIÊU" || h === "CHI TIEU",
  );
  const missing: string[] = [];
  if (dateIdx < 0) missing.push("NGÀY");
  if (costIdx < 0) missing.push("CHI TIÊU");
  if (missing.length > 0) {
    return { kind: "invalid-header", missing };
  }

  const rows: CostRow[] = [];
  const seenByDate = new Map<string, number>(); // dedupe within file
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const dateRaw = cells[dateIdx] ?? "";
    const costRaw = cells[costIdx] ?? "";
    const periodDate = parseDateDMY(dateRaw);
    const amount = parseMoney(costRaw);
    if (!periodDate || !amount) continue;
    // Nếu cùng ngày xuất hiện 2 lần trong file → lấy tổng (cộng dồn)
    const prev = seenByDate.get(periodDate);
    seenByDate.set(periodDate, (prev ?? 0) + amount);
  }
  for (const [periodDate, amount] of seenByDate) {
    rows.push({ periodDate, amount });
  }

  return { kind: "ok", rows };
}
