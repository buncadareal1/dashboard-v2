import { describe, it, expect } from "vitest";
import { resolveStage } from "./stage-mapper.js";

describe("resolveStage", () => {
  describe("no-stage cases", () => {
    it("returns no-stage for null", () => {
      expect(resolveStage(null, new Map())).toEqual({ kind: "no-stage" });
    });

    it("returns no-stage for undefined", () => {
      expect(resolveStage(undefined, new Map())).toEqual({ kind: "no-stage" });
    });

    it("returns no-stage for empty string", () => {
      expect(resolveStage("", new Map())).toEqual({ kind: "no-stage" });
    });

    it("returns no-stage for whitespace-only string", () => {
      expect(resolveStage("   ", new Map())).toEqual({ kind: "no-stage" });
    });
  });

  describe("unknown cases", () => {
    it("returns unknown when raw stage key not in alias map", () => {
      const map = new Map([["tiêm lịch", "stage-1"]]);
      const result = resolveStage("Không có", map);
      expect(result).toEqual({ kind: "unknown", raw: "Không có" });
    });

    it("returns the original trimmed string as raw", () => {
      const map = new Map<string, string | null>();
      const result = resolveStage("  SomeStage  ", map);
      expect(result).toEqual({ kind: "unknown", raw: "SomeStage" });
    });

    it("lookup is case-insensitive and space-collapsed", () => {
      // map has lowercase key, raw has uppercase — should still match
      const map = new Map<string, string | null>([["some stage", "id-1"]]);
      const result = resolveStage("SOME STAGE", map);
      expect(result).toEqual({ kind: "matched", stageId: "id-1" });
    });
  });

  describe("pending cases", () => {
    it("returns pending when alias map has null value for the key", () => {
      const map = new Map<string, string | null>([["chờ xử lý", null]]);
      const result = resolveStage("Chờ xử lý", map);
      expect(result).toEqual({ kind: "pending", raw: "Chờ xử lý" });
    });

    it("pending raw preserves the original trimmed text", () => {
      const map = new Map<string, string | null>([["pending stage", null]]);
      const result = resolveStage("  Pending Stage  ", map);
      expect(result).toEqual({ kind: "pending", raw: "Pending Stage" });
    });
  });

  describe("matched cases", () => {
    it("returns matched with stageId when key found and value is non-null", () => {
      const map = new Map<string, string | null>([["tiêm lịch", "stage-abc"]]);
      const result = resolveStage("Tiêm lịch", map);
      expect(result).toEqual({ kind: "matched", stageId: "stage-abc" });
    });

    it("matches after collapsing multiple spaces in raw", () => {
      const map = new Map<string, string | null>([["tư vấn", "stage-tv"]]);
      const result = resolveStage("Tư  Vấn", map);
      // key becomes "tư  vấn" after toLowerCase but spaces collapsed to "tư vấn"
      expect(result).toEqual({ kind: "matched", stageId: "stage-tv" });
    });

    it("matches exact lowercase key directly", () => {
      const map = new Map<string, string | null>([["hot", "stage-hot"]]);
      const result = resolveStage("hot", map);
      expect(result).toEqual({ kind: "matched", stageId: "stage-hot" });
    });

    it("stageId is passed through unchanged", () => {
      const map = new Map<string, string | null>([
        ["confirmed", "uuid-stage-999"],
      ]);
      const result = resolveStage("Confirmed", map);
      expect(result).toEqual({ kind: "matched", stageId: "uuid-stage-999" });
    });
  });

  describe("edge cases", () => {
    it("handles tab characters in raw stage (treated as non-space whitespace)", () => {
      // \t is not collapsed by \s+ replacement — raw becomes "stage\there"
      // key becomes "stage\there" after replace(/\s+/g, " ") → "stage here"
      const map = new Map<string, string | null>([["stage here", "id-1"]]);
      const result = resolveStage("Stage\there", map);
      expect(result).toEqual({ kind: "matched", stageId: "id-1" });
    });

    it("handles large alias map efficiently", () => {
      const map = new Map<string, string | null>(
        Array.from({ length: 1000 }, (_, i) => [`stage-${i}`, `id-${i}`]),
      );
      const result = resolveStage("stage-999", map);
      expect(result).toEqual({ kind: "matched", stageId: "id-999" });
    });
  });
});
