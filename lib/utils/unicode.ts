/**
 * Unicode normalization helpers cho matcher CSV.
 * Xử lý tiếng Việt: NFD decompose + bỏ dấu + lowercase + trim.
 */

/**
 * Normalize tên người để match cross-source (Facebook ↔ Bitrix).
 *
 * @example
 * normalizeName("Nguyễn Văn Á") // "nguyen van a"
 * normalizeName("  TRẦN  THỊ  Bé  ") // "tran thi be"
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ combining diacritical marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize SĐT Việt Nam: bỏ ký tự không phải số, +84/84 → 0.
 *
 * @example
 * normalizePhone("+84 912 345 678") // "0912345678"
 * normalizePhone("84-912-345-678") // "0912345678"
 * normalizePhone("0912.345.678") // "0912345678"
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  let phone = input.replace(/[^\d+]/g, "");
  if (phone.startsWith("+84")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("84") && phone.length >= 11)
    phone = "0" + phone.slice(2);
  return phone;
}
