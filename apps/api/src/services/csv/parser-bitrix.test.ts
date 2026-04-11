import { describe, it, expect } from "vitest";
import { parseBitrixCsv, BITRIX_REQUIRED_HEADERS } from "./parser-bitrix.js";

function buildBitrixCsv(
  rows: Record<string, string>[],
  extraHeaders: string[] = [],
): string {
  const headers = [...BITRIX_REQUIRED_HEADERS, ...extraHeaders];
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => row[h] ?? "").join(","),
  );
  return [headerLine, ...dataLines].join("\n");
}

const baseRow: Record<string, string> = {
  Lead: "Nguyen Van A",
  Stage: "Tiêm lịch",
  Responsible: "Tran Thi B - Team 1",
  "Updated Time": "15/06/2023 10:00",
};

describe("parseBitrixCsv", () => {
  describe("invalid-header cases", () => {
    it("returns invalid-header when required columns are missing", () => {
      const result = parseBitrixCsv("Name,Status\nJohn,Active");
      expect(result.kind).toBe("invalid-header");
      if (result.kind !== "invalid-header") throw new Error();
      expect(result.missing).toContain("Lead");
      expect(result.missing).toContain("Stage");
      expect(result.missing).toContain("Responsible");
      expect(result.missing).toContain("Updated Time");
    });

    it("returns invalid-header listing only actually missing columns", () => {
      const result = parseBitrixCsv("Lead,Stage\nNguyen,Hot");
      expect(result.kind).toBe("invalid-header");
      if (result.kind !== "invalid-header") throw new Error();
      expect(result.missing).toContain("Responsible");
      expect(result.missing).toContain("Updated Time");
      expect(result.missing).not.toContain("Lead");
      expect(result.missing).not.toContain("Stage");
    });

    it("returns parse-error or invalid-header for empty string", () => {
      // papaparse may produce a parse-error for fully empty input before header check
      const result = parseBitrixCsv("");
      expect(["parse-error", "invalid-header"]).toContain(result.kind);
    });
  });

  describe("ok cases — basic parsing", () => {
    it("returns ok with correct row count", () => {
      const csv = buildBitrixCsv([
        baseRow,
        { ...baseRow, Lead: "Le Van C" },
      ]);
      const result = parseBitrixCsv(csv);
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") throw new Error();
      expect(result.rows).toHaveLength(2);
    });

    it("maps Lead column to fullName", () => {
      const csv = buildBitrixCsv([baseRow]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].fullName).toBe("Nguyen Van A");
    });

    it("normalizes fullName", () => {
      const csv = buildBitrixCsv([{ ...baseRow, Lead: "Nguyễn Văn A" }]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].fullNameNormalized).toBe("nguyen van a");
    });

    it("maps Stage column to rawStage", () => {
      const csv = buildBitrixCsv([baseRow]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].rawStage).toBe("Tiêm lịch");
    });

    it("sets rawStage to null when Stage column is empty", () => {
      const csv = buildBitrixCsv([{ ...baseRow, Stage: "" }]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].rawStage).toBeNull();
    });

    it("returns empty rows array for header-only CSV", () => {
      const csv = BITRIX_REQUIRED_HEADERS.join(",");
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("responsible parsing", () => {
    it("splits employee name and team from 'Name - Team' format", () => {
      const csv = buildBitrixCsv([
        { ...baseRow, Responsible: "Tran Thi B - Team Alpha" },
      ]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].employeeName).toBe("Tran Thi B");
      expect(result.rows[0].employeeTeam).toBe("Team Alpha");
    });

    it("sets team to null when no dash separator in Responsible", () => {
      const csv = buildBitrixCsv([
        { ...baseRow, Responsible: "Tran Thi B" },
      ]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].employeeName).toBe("Tran Thi B");
      expect(result.rows[0].employeeTeam).toBeNull();
    });

    it("sets employeeName and team to null when Responsible is empty", () => {
      const csv = buildBitrixCsv([{ ...baseRow, Responsible: "" }]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].employeeName).toBeNull();
      expect(result.rows[0].employeeTeam).toBeNull();
    });

    it("normalizes employeeName", () => {
      const csv = buildBitrixCsv([
        { ...baseRow, Responsible: "Trần Thị B - Team 1" },
      ]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].employeeNameNormalized).toBe("tran thi b");
    });

    it("sets employeeNameNormalized to null when no employee name", () => {
      const csv = buildBitrixCsv([{ ...baseRow, Responsible: "" }]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].employeeNameNormalized).toBeNull();
    });

    it("uses last ' - ' occurrence to split when name itself contains dash", () => {
      // "Nguyen-Van B - Team X" → name="Nguyen-Van B", team="Team X"
      const csv = buildBitrixCsv([
        { ...baseRow, Responsible: "Nguyen-Van B - Team X" },
      ]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].employeeName).toBe("Nguyen-Van B");
      expect(result.rows[0].employeeTeam).toBe("Team X");
    });
  });

  describe("date parsing", () => {
    it("parses Updated Time in DD/MM/YYYY HH:MM format", () => {
      const csv = buildBitrixCsv([
        { ...baseRow, "Updated Time": "15/06/2023 14:30" },
      ]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      const d = result.rows[0].bitrixUpdatedAt;
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2023);
      expect(d!.getUTCMonth()).toBe(5);
      expect(d!.getUTCDate()).toBe(15);
      expect(d!.getUTCHours()).toBe(14);
    });

    it("returns null bitrixUpdatedAt for invalid date", () => {
      const csv = buildBitrixCsv([
        { ...baseRow, "Updated Time": "not-a-date" },
      ]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].bitrixUpdatedAt).toBeNull();
    });
  });

  describe("comment column", () => {
    it("reads comment when present", () => {
      const csv = buildBitrixCsv(
        [{ ...baseRow, Comment: "Some note" }],
        ["Comment"],
      );
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].comment).toBe("Some note");
    });

    it("sets comment to null when Comment column is absent", () => {
      const csv = buildBitrixCsv([baseRow]);
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].comment).toBeNull();
    });

    it("sets comment to null when Comment column is empty", () => {
      const csv = buildBitrixCsv(
        [{ ...baseRow, Comment: "" }],
        ["Comment"],
      );
      const result = parseBitrixCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].comment).toBeNull();
    });
  });
});
