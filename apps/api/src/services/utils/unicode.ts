/**
 * Unicode utilities — copied from lib/utils/unicode.ts.
 * Shared between CSV parsers and upsert service.
 */

/**
 * NFD fold → bỏ dấu → lowercase → collapse whitespace.
 * Dùng để normalize tên người (matching + dedup).
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalize SĐT Việt Nam → dạng 0xxxxxxxxx.
 * Bỏ ký tự không phải số, convert +84/84 → 0.
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  let phone = input.replace(/[^\d+]/g, "");
  if (phone.startsWith("+84")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("84") && phone.length >= 11)
    phone = "0" + phone.slice(2);
  return phone;
}

/**
 * Normalize tên entity ads (campaign/adset/ad): trim + collapse whitespace,
 * GIỮ NGUYÊN casing và dấu. Dùng khi muốn lưu canonical name vào DB.
 */
export function normalizeEntityName(
  input: string | null | undefined,
): string {
  if (!input) return "";
  return input.trim().replace(/\s+/g, " ");
}

/**
 * Lookup key case-insensitive cho entity ads — dùng so sánh, KHÔNG dùng lưu DB.
 */
export function entityLookupKey(
  input: string | null | undefined,
): string {
  return normalizeEntityName(input).toLowerCase();
}
