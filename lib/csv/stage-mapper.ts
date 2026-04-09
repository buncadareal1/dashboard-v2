/**
 * Resolve raw stage string từ Bitrix CSV → stageId hoặc flag.
 * Pure function — DB lookup do caller cung cấp qua aliasMap.
 *
 * Pattern: caller load `stage_aliases` table → build Map<raw, stageId|null>
 * → call resolveStage cho mỗi row → handle kết quả:
 *   - matched → upsert lead với stageId
 *   - pending → alias tồn tại nhưng admin chưa map (giữ null + flag review)
 *   - unknown → alias chưa tồn tại, caller cần insert vào stage_aliases (stageId=null)
 *   - no-stage → row không có stage column, skip
 */
export type ResolveResult =
  | { kind: "matched"; stageId: string }
  | { kind: "pending"; raw: string }
  | { kind: "unknown"; raw: string }
  | { kind: "no-stage" };

export function resolveStage(
  raw: string | null | undefined,
  aliasMap: Map<string, string | null>,
): ResolveResult {
  if (!raw || !raw.trim()) return { kind: "no-stage" };

  const trimmed = raw.trim();
  if (!aliasMap.has(trimmed)) {
    return { kind: "unknown", raw: trimmed };
  }

  const stageId = aliasMap.get(trimmed);
  if (stageId == null) {
    return { kind: "pending", raw: trimmed };
  }
  return { kind: "matched", stageId };
}
