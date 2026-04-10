import { describe, it, expect } from "vitest";
import { resolveStage } from "./stage-mapper";

/**
 * Pure function: takes raw stage string + alias map → returns ResolveResult.
 * DB lookup separated to caller. Tests cover algorithm only.
 */
describe("resolveStage", () => {
  // NOTE: keys must be LOWERCASED — upsert-service's loadStageAliasMap
  // builds the map with lowercase keys. resolveStage lowercases the
  // incoming raw string before lookup.
  const aliasMap = new Map<string, string | null>([
    ["f1 (qt dự án cụ thể)", "stage-f1-id"],
    ["f1", "stage-f1-id"],
    ["đang chăm (2h)", "stage-dc-id"],
    ["đang chăm", "stage-dc-id"],
    ["booking", "stage-booking-id"],
    ["lead pending review", null],
  ]);

  it("match exact raw → trả stageId", () => {
    expect(resolveStage("F1 (QT dự án cụ thể)", aliasMap)).toEqual({
      kind: "matched",
      stageId: "stage-f1-id",
    });
  });

  it("match variant (Đang Chăm vs Đang Chăm (2h))", () => {
    expect(resolveStage("Đang Chăm (2h)", aliasMap).kind).toBe("matched");
    expect(resolveStage("Đang Chăm", aliasMap).kind).toBe("matched");
  });

  it("alias tồn tại nhưng stageId=null → pending", () => {
    expect(resolveStage("Lead Pending Review", aliasMap)).toEqual({
      kind: "pending",
      raw: "Lead Pending Review",
    });
  });

  it("raw chưa có trong alias map → unknown (cần tạo alias mới)", () => {
    expect(resolveStage("Stage Hoàn Toàn Mới", aliasMap)).toEqual({
      kind: "unknown",
      raw: "Stage Hoàn Toàn Mới",
    });
  });

  it("raw rỗng/null → no-stage", () => {
    expect(resolveStage("", aliasMap)).toEqual({ kind: "no-stage" });
    expect(resolveStage(null, aliasMap)).toEqual({ kind: "no-stage" });
    expect(resolveStage(undefined, aliasMap)).toEqual({ kind: "no-stage" });
  });

  it("trim whitespace ở raw input", () => {
    expect(resolveStage("  F1  ", aliasMap).kind).toBe("matched");
  });

  it("case-insensitive + collapse whitespace", () => {
    // "Đang chăm" (lowercase c) matches alias "đang chăm"
    expect(resolveStage("Đang chăm", aliasMap).kind).toBe("matched");
    // "f1" lowercase matches
    expect(resolveStage("f1", aliasMap).kind).toBe("matched");
    // double whitespace collapses
    expect(resolveStage("Đang  Chăm", aliasMap).kind).toBe("matched");
  });
});
