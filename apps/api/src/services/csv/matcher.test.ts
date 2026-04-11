import { describe, it, expect } from "vitest";
import { matchLead, type LeadCandidate, type IncomingLead } from "./matcher.js";

const candidate = (
  id: string,
  name: string,
  phone: string | null = null,
): LeadCandidate => ({
  id,
  fullNameNormalized: name,
  phoneNormalized: phone,
});

describe("matchLead", () => {
  describe("no-match cases", () => {
    it("returns no-match when incoming name is empty string", () => {
      const result = matchLead(
        { fullNameNormalized: "", phoneNormalized: null },
        [candidate("1", "nguyen van a")],
      );
      expect(result).toEqual({ kind: "no-match" });
    });

    it("returns no-match when candidate list is empty", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: null },
        [],
      );
      expect(result).toEqual({ kind: "no-match" });
    });

    it("returns no-match when no candidate name matches", () => {
      const result = matchLead(
        { fullNameNormalized: "tran thi b", phoneNormalized: null },
        [candidate("1", "nguyen van a"), candidate("2", "le van c")],
      );
      expect(result).toEqual({ kind: "no-match" });
    });

    it("returns no-match when candidate has empty normalized name", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: null },
        [candidate("1", "")],
      );
      expect(result).toEqual({ kind: "no-match" });
    });
  });

  describe("matched cases", () => {
    it("returns matched when exactly one candidate has same name", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: null },
        [candidate("42", "nguyen van a"), candidate("99", "tran thi b")],
      );
      expect(result).toEqual({ kind: "matched", leadId: "42" });
    });

    it("returns matched lead ID as string", () => {
      const result = matchLead(
        { fullNameNormalized: "le van c", phoneNormalized: null },
        [candidate("lead-uuid-123", "le van c")],
      );
      expect(result).toEqual({ kind: "matched", leadId: "lead-uuid-123" });
    });

    it("breaks name conflict using phone number — returns matched", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: "0912345678" },
        [
          candidate("1", "nguyen van a", "0912345678"),
          candidate("2", "nguyen van a", "0987654321"),
        ],
      );
      expect(result).toEqual({ kind: "matched", leadId: "1" });
    });

    it("phone match picks second candidate correctly", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: "0987654321" },
        [
          candidate("1", "nguyen van a", "0912345678"),
          candidate("2", "nguyen van a", "0987654321"),
        ],
      );
      expect(result).toEqual({ kind: "matched", leadId: "2" });
    });
  });

  describe("conflict cases", () => {
    it("returns conflict when multiple candidates share same name and no phone", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: null },
        [
          candidate("1", "nguyen van a"),
          candidate("2", "nguyen van a"),
        ],
      );
      expect(result).toEqual({
        kind: "conflict",
        candidateIds: ["1", "2"],
      });
    });

    it("returns conflict when same name, incoming has phone but multiple candidates also share that phone", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: "0912345678" },
        [
          candidate("1", "nguyen van a", "0912345678"),
          candidate("2", "nguyen van a", "0912345678"),
        ],
      );
      expect(result).toEqual({
        kind: "conflict",
        candidateIds: ["1", "2"],
      });
    });

    it("returns conflict (not no-match) when name matches but phone matches none", () => {
      // incoming has a phone, but neither duplicate candidate matches it
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: "0900000000" },
        [
          candidate("1", "nguyen van a", "0912345678"),
          candidate("2", "nguyen van a", "0987654321"),
        ],
      );
      expect(result).toEqual({
        kind: "conflict",
        candidateIds: ["1", "2"],
      });
    });

    it("conflict includes all matching candidate IDs", () => {
      const result = matchLead(
        { fullNameNormalized: "nguyen van a", phoneNormalized: null },
        [
          candidate("a", "nguyen van a"),
          candidate("b", "nguyen van a"),
          candidate("c", "nguyen van a"),
        ],
      );
      if (result.kind !== "conflict") throw new Error("expected conflict");
      expect(result.candidateIds).toHaveLength(3);
      expect(result.candidateIds).toContain("a");
      expect(result.candidateIds).toContain("b");
      expect(result.candidateIds).toContain("c");
    });
  });
});
