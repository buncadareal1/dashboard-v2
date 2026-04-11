/**
 * Pure matcher: input incoming lead + list candidates → MatchResult.
 * Caller chịu trách nhiệm query DB lấy candidates.
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

  const sameName = candidates.filter(
    (c) =>
      c.fullNameNormalized && c.fullNameNormalized === incoming.fullNameNormalized,
  );

  if (sameName.length === 0) return { kind: "no-match" };
  if (sameName.length === 1) {
    return { kind: "matched", leadId: sameName[0].id };
  }

  if (incoming.phoneNormalized) {
    const samePhone = sameName.filter(
      (c) => c.phoneNormalized === incoming.phoneNormalized,
    );
    if (samePhone.length === 1) {
      return { kind: "matched", leadId: samePhone[0].id };
    }
  }

  return {
    kind: "conflict",
    candidateIds: sameName.map((c) => c.id),
  };
}
