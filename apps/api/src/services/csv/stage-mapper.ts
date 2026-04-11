/**
 * Pure function: takes raw stage string + alias map → returns ResolveResult.
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
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (!aliasMap.has(key)) {
    return { kind: "unknown", raw: trimmed };
  }

  const stageId = aliasMap.get(key);
  if (stageId == null) {
    return { kind: "pending", raw: trimmed };
  }
  return { kind: "matched", stageId };
}
