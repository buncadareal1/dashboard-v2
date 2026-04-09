/**
 * Pure matcher: input incoming lead + list candidates (đã pre-filter project)
 * → MatchResult.
 *
 * Caller chịu trách nhiệm:
 * - Query DB lấy candidates: SELECT id, full_name_normalized, phone_normalized
 *     FROM leads WHERE project_id = ? AND full_name_normalized = ?
 * - Hoặc preload tất cả lead của project rồi truyền vào.
 *
 * Không match name rỗng — incoming name rỗng = không có manh mối, no-match.
 */

export type LeadCandidate = {
  id: string;
  fullNameNormalized: string;
  phoneNormalized: string | null;
};

export type IncomingLead = {
  fullNameNormalized: string;
  phoneNormalized: string | null;
};

export type MatchResult =
  | { kind: "matched"; leadId: string }
  | { kind: "no-match" }
  | { kind: "conflict"; candidateIds: string[] };

export function matchLead(
  incoming: IncomingLead,
  candidates: LeadCandidate[],
): MatchResult {
  if (!incoming.fullNameNormalized) return { kind: "no-match" };

  // Step 1: filter theo tên
  const sameName = candidates.filter(
    (c) =>
      c.fullNameNormalized && c.fullNameNormalized === incoming.fullNameNormalized,
  );

  if (sameName.length === 0) return { kind: "no-match" };
  if (sameName.length === 1) {
    return { kind: "matched", leadId: sameName[0].id };
  }

  // Step 2: nhiều cùng tên — fallback theo phone
  if (incoming.phoneNormalized) {
    const samePhone = sameName.filter(
      (c) => c.phoneNormalized === incoming.phoneNormalized,
    );
    if (samePhone.length === 1) {
      return { kind: "matched", leadId: samePhone[0].id };
    }
  }

  // Conflict: nhiều cùng tên + (incoming không có phone, hoặc phone không unique-match)
  return {
    kind: "conflict",
    candidateIds: sameName.map((c) => c.id),
  };
}
