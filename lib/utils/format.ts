/**
 * Format helpers tiếng Việt cho UI.
 */

const VND = new Intl.NumberFormat("vi-VN");

/**
 * Format số kiểu Việt Nam.
 * @example formatNumber(1247) // "1.247"
 */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return VND.format(n);
}

/**
 * Format tiền VND viết tắt: M (triệu), B (tỷ), K (nghìn).
 * Frontend mẫu dùng style này.
 *
 * @example
 * formatCurrencyShort(850_000_000) // "850M"
 * formatCurrencyShort(1_245_000_000) // "1.2B"
 * formatCurrencyShort(682_000) // "682K"
 */
export function formatCurrencyShort(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) {
    const b = n / 1_000_000_000;
    return `${b.toFixed(b >= 10 ? 0 : 1).replace(/\.0$/, "")}B`;
  }
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m.toFixed(m >= 10 ? 0 : 1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}K`;
  }
  return n.toString();
}

/**
 * Format ngày kiểu DD/MM/YYYY.
 */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format giờ:phút.
 */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format phần trăm.
 * @example formatPercent(0.335) // "33.5%"
 */
export function formatPercent(
  ratio: number | null | undefined,
  decimals = 1,
): string {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(decimals)}%`;
}
