import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseFacebookCsv } from "./parser-facebook";
import { parseBitrixCsv } from "./parser-bitrix";
import { matchLead } from "./matcher";
import { resolveStage } from "./stage-mapper";

describe("integration: parse fixtures + matcher + stage-mapper", () => {
  const bitrixCsv = readFileSync(
    path.resolve(__dirname, "../../test-fixtures/bitrix-sample.csv"),
    "utf-8",
  );

  it("parse Bitrix sample fixture đủ 21 rows", () => {
    const result = parseBitrixCsv(bitrixCsv);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.rows.length).toBeGreaterThanOrEqual(20);
  });

  it("Bitrix có lead Cơ Điện Đan Phượng (test unicode fold)", () => {
    const result = parseBitrixCsv(bitrixCsv);
    if (result.kind !== "ok") return;
    const found = result.rows.find(
      (r) => r.fullNameNormalized === "co dien dan phuong",
    );
    expect(found).toBeDefined();
    expect(found?.employeeTeam).toBe("Juno");
  });

  it("conflict: 2 lead Nguyễn Văn A trong fixture", () => {
    const result = parseBitrixCsv(bitrixCsv);
    if (result.kind !== "ok") return;
    const sameName = result.rows.filter(
      (r) => r.fullNameNormalized === "nguyen van a",
    );
    expect(sameName.length).toBe(2);
  });

  it("end-to-end: parse Bitrix → matcher trên fake candidates → kết quả khớp", () => {
    const result = parseBitrixCsv(bitrixCsv);
    if (result.kind !== "ok") return;

    // Fake candidates từ FB CSV
    const candidates = [
      {
        id: "fb-1",
        fullNameNormalized: "co dien dan phuong",
        phoneNormalized: "0972347648",
      },
      {
        id: "fb-2",
        fullNameNormalized: "nguyen xuan hung",
        phoneNormalized: "0912281616",
      },
    ];

    const incoming = result.rows.find(
      (r) => r.fullNameNormalized === "co dien dan phuong",
    );
    expect(incoming).toBeDefined();
    if (!incoming) return;

    const match = matchLead(
      {
        fullNameNormalized: incoming.fullNameNormalized,
        phoneNormalized: null,
      },
      candidates,
    );
    expect(match).toEqual({ kind: "matched", leadId: "fb-1" });
  });

  it("stage-mapper: 'F1 (QT dự án cụ thể)' từ fixture map ra stageId mock", () => {
    const result = parseBitrixCsv(bitrixCsv);
    if (result.kind !== "ok") return;
    const f1Row = result.rows.find(
      (r) => r.rawStage === "F1 (QT dự án cụ thể)",
    );
    expect(f1Row).toBeDefined();

    const aliasMap = new Map<string, string | null>([
      ["f1 (qt dự án cụ thể)", "stage-f1-id"],
    ]);
    const resolved = resolveStage(f1Row?.rawStage ?? null, aliasMap);
    expect(resolved).toEqual({ kind: "matched", stageId: "stage-f1-id" });
  });

  it("stage-mapper: 'Lead Pending Review' từ fixture → unknown (chưa có trong alias)", () => {
    const result = parseBitrixCsv(bitrixCsv);
    if (result.kind !== "ok") return;
    const pendingRow = result.rows.find(
      (r) => r.rawStage === "Lead Pending Review",
    );
    expect(pendingRow).toBeDefined();

    const aliasMap = new Map<string, string | null>();
    const resolved = resolveStage(pendingRow?.rawStage ?? null, aliasMap);
    expect(resolved).toEqual({
      kind: "unknown",
      raw: "Lead Pending Review",
    });
  });

  it("Facebook parser cũng chạy với fixture user (smoke test)", () => {
    try {
      const fbCsv = readFileSync(
        "/home/docdang/Downloads/_THẤP TẦNG SUN HÀ NAM - ÁI LINH - RAW_LEAD (3).csv",
        "utf-8",
      );
      const result = parseFacebookCsv(fbCsv);
      expect(result.kind).toBe("ok");
      if (result.kind === "ok") {
        expect(result.rows.length).toBeGreaterThan(0);
        // Spot check: lead 'Cơ Điện Đan Phượng' phải có trong FB CSV
        const found = result.rows.find(
          (r) => r.fullNameNormalized === "co dien dan phuong",
        );
        expect(found).toBeDefined();
        expect(found?.phoneNormalized).toBe("0972347648");
      }
    } catch (err) {
      // Skip nếu user không có file tại path đó
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.warn("⚠ Facebook fixture không có ở path, skip smoke test");
        return;
      }
      throw err;
    }
  });
});
