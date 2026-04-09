import { describe, it, expect } from "vitest";
import { matchLead } from "./matcher";
import type { LeadCandidate, IncomingLead } from "./matcher";

/**
 * Pure matcher: takes incoming lead + list candidates (đã pre-filter theo project)
 * → MatchResult.
 *
 * Logic:
 * 1. Filter candidates theo full_name_normalized = incoming.fullNameNormalized
 * 2. Nếu 0 → no-match
 * 3. Nếu 1 → matched
 * 4. Nếu nhiều → fallback theo phone:
 *    - Filter thêm theo phone_normalized
 *    - 1 match → matched
 *    - 0/nhiều → conflict
 */

const cand = (
  id: string,
  name: string,
  phone: string | null = null,
): LeadCandidate => ({
  id,
  fullNameNormalized: name,
  phoneNormalized: phone,
});

const incoming = (name: string, phone: string | null = null): IncomingLead => ({
  fullNameNormalized: name,
  phoneNormalized: phone,
});

describe("matchLead", () => {
  it("zero candidate → no-match", () => {
    expect(matchLead(incoming("nguyen van a"), [])).toEqual({
      kind: "no-match",
    });
  });

  it("1 candidate match name → matched", () => {
    const candidates = [cand("lead-1", "nguyen van a", "0912345678")];
    expect(matchLead(incoming("nguyen van a"), candidates)).toEqual({
      kind: "matched",
      leadId: "lead-1",
    });
  });

  it("1 candidate khác tên → no-match", () => {
    const candidates = [cand("lead-1", "tran thi b", null)];
    expect(matchLead(incoming("nguyen van a"), candidates)).toEqual({
      kind: "no-match",
    });
  });

  it("nhiều candidate cùng tên — phone fallback unique → matched", () => {
    const candidates = [
      cand("lead-1", "nguyen van a", "0912345678"),
      cand("lead-2", "nguyen van a", "0987654321"),
    ];
    const result = matchLead(
      incoming("nguyen van a", "0987654321"),
      candidates,
    );
    expect(result).toEqual({ kind: "matched", leadId: "lead-2" });
  });

  it("nhiều candidate cùng tên — phone không match ai → conflict", () => {
    const candidates = [
      cand("lead-1", "nguyen van a", "0912345678"),
      cand("lead-2", "nguyen van a", "0987654321"),
    ];
    const result = matchLead(
      incoming("nguyen van a", "0900000000"),
      candidates,
    );
    expect(result.kind).toBe("conflict");
    if (result.kind === "conflict") {
      expect(result.candidateIds).toEqual(["lead-1", "lead-2"]);
    }
  });

  it("nhiều candidate cùng tên — incoming không có phone → conflict", () => {
    const candidates = [
      cand("lead-1", "nguyen van a", "0912345678"),
      cand("lead-2", "nguyen van a", "0987654321"),
    ];
    const result = matchLead(incoming("nguyen van a", null), candidates);
    expect(result.kind).toBe("conflict");
  });

  it("nhiều candidate cùng tên — phone match nhiều → conflict", () => {
    // Edge: 2 candidate cùng phone (data dirty)
    const candidates = [
      cand("lead-1", "nguyen van a", "0912345678"),
      cand("lead-2", "nguyen van a", "0912345678"),
    ];
    const result = matchLead(
      incoming("nguyen van a", "0912345678"),
      candidates,
    );
    expect(result.kind).toBe("conflict");
  });

  it("incoming name khớp 1 candidate có phone, candidate khác không có phone → matched cái có phone nếu khớp", () => {
    const candidates = [
      cand("lead-1", "nguyen van a", null),
      cand("lead-2", "nguyen van a", "0912345678"),
    ];
    const result = matchLead(
      incoming("nguyen van a", "0912345678"),
      candidates,
    );
    expect(result).toEqual({ kind: "matched", leadId: "lead-2" });
  });

  it("incoming name khớp 1 candidate, không trùng tên với ai khác → matched (no fallback needed)", () => {
    const candidates = [
      cand("lead-1", "nguyen van a", null),
      cand("lead-2", "tran thi b", "0987654321"),
    ];
    expect(matchLead(incoming("nguyen van a"), candidates)).toEqual({
      kind: "matched",
      leadId: "lead-1",
    });
  });

  it("name rỗng → no-match (không match candidate có tên rỗng)", () => {
    const candidates = [cand("lead-1", "", null)];
    expect(matchLead(incoming("", null), candidates)).toEqual({
      kind: "no-match",
    });
  });
});
