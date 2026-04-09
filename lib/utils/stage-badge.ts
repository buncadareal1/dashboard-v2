/**
 * Map stage label (Vietnamese) → Badge variant.
 * Used by LeadDetailTable to color stage badges consistently.
 */

type StageBadgeVariant =
  | "new"
  | "contacted"
  | "qualified"
  | "won"
  | "lost"
  | "default";

const NORMALIZE = (s: string) => s.toLowerCase().trim();

export function stageBadgeVariant(label: string | null | undefined): StageBadgeVariant {
  if (!label) return "default";
  const s = NORMALIZE(label);

  // Won — booking, deposit, contract
  if (
    s.includes("booking") ||
    s.includes("đặt cọc") ||
    s.includes("dat coc") ||
    s.includes("hợp đồng") ||
    s.includes("hop dong") ||
    s.includes("won") ||
    s.includes("thành công")
  ) {
    return "won";
  }

  // Lost — không bắt máy, thuê bao, môi giới, không quan tâm
  if (
    s.includes("không bắt máy") ||
    s.includes("khong bat may") ||
    s.includes("thuê bao") ||
    s.includes("thue bao") ||
    s.includes("môi giới") ||
    s.includes("moi gioi") ||
    s.includes("không quan tâm") ||
    s.includes("lost") ||
    s.includes("hủy")
  ) {
    return "lost";
  }

  // Qualified — F1, đang chăm
  if (
    s.includes("f1") ||
    s.includes("đang chăm") ||
    s.includes("dang cham") ||
    s.includes("qualified")
  ) {
    return "qualified";
  }

  // Contacted — đã liên hệ, gọi lại
  if (
    s.includes("đã liên hệ") ||
    s.includes("contacted") ||
    s.includes("gọi lại") ||
    s.includes("chào da khác") ||
    s.includes("chao da khac")
  ) {
    return "contacted";
  }

  // New — lead mới, pending
  if (
    s.includes("lead mới") ||
    s.includes("lead moi") ||
    s.includes("new") ||
    s.includes("pending")
  ) {
    return "new";
  }

  return "default";
}
