import { describe, it, expect } from "vitest";
import { parseCostCsv } from "./parser-cost.js";

describe("parseCostCsv", () => {
  describe("parse-error cases", () => {
    it("returns parse-error for completely empty input", () => {
      const result = parseCostCsv("");
      expect(result.kind).toBe("parse-error");
    });

    it("returns parse-error for single-line input (no data rows)", () => {
      const result = parseCostCsv("STT,NGÀY,CHI TIÊU");
      expect(result.kind).toBe("parse-error");
    });
  });

  describe("invalid-header cases", () => {
    it("returns invalid-header when NGÀY column is missing", () => {
      const csv = "STT,CHI TIÊU,LEAD\n1,150000,5";
      const result = parseCostCsv(csv);
      expect(result.kind).toBe("invalid-header");
      if (result.kind !== "invalid-header") throw new Error();
      expect(result.missing).toContain("NGÀY");
    });

    it("returns invalid-header when CHI TIÊU column is missing", () => {
      const csv = "STT,NGÀY,LEAD\n1,01/01/2024,5";
      const result = parseCostCsv(csv);
      expect(result.kind).toBe("invalid-header");
      if (result.kind !== "invalid-header") throw new Error();
      expect(result.missing).toContain("CHI TIÊU");
    });

    it("returns invalid-header when both required columns are missing", () => {
      const csv = "STT,LEAD,F1\n1,5,2";
      const result = parseCostCsv(csv);
      expect(result.kind).toBe("invalid-header");
      if (result.kind !== "invalid-header") throw new Error();
      expect(result.missing).toHaveLength(2);
    });

    it("accepts NGAY (no diacritic) as alternative to NGÀY", () => {
      const csv = "NGAY,CHI TIEU\n01/01/2024,150000";
      const result = parseCostCsv(csv);
      expect(result.kind).toBe("ok");
    });

    it("accepts CHI TIEU (no diacritic) as alternative to CHI TIÊU", () => {
      const csv = "NGAY,CHI TIEU\n01/01/2024,150000";
      const result = parseCostCsv(csv);
      expect(result.kind).toBe("ok");
    });
  });

  describe("ok cases — basic parsing", () => {
    it("parses a simple valid CSV", () => {
      const csv = "NGÀY,CHI TIÊU\n01/06/2024,150000";
      const result = parseCostCsv(csv);
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") throw new Error();
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].periodDate).toBe("2024-06-01");
      expect(result.rows[0].amount).toBe(150000);
    });

    it("converts date to YYYY-MM-DD format", () => {
      const csv = "NGÀY,CHI TIÊU\n05/03/2023,50000";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].periodDate).toBe("2023-03-05");
    });

    it("zero-pads single-digit day and month", () => {
      const csv = "NGÀY,CHI TIÊU\n5/3/2023,50000";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].periodDate).toBe("2023-03-05");
    });

    it("skips rows with invalid date", () => {
      const csv = "NGÀY,CHI TIÊU\nnot-a-date,150000\n01/06/2024,200000";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].periodDate).toBe("2024-06-01");
    });

    it("skips rows with zero or non-positive amount", () => {
      const csv = "NGÀY,CHI TIÊU\n01/06/2024,0\n02/06/2024,100000";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].periodDate).toBe("2024-06-02");
    });

    it("skips rows with empty amount", () => {
      const csv = "NGÀY,CHI TIÊU\n01/06/2024,\n02/06/2024,50000";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(1);
    });

    it("returns empty rows array when all data rows are invalid", () => {
      const csv = "NGÀY,CHI TIÊU\nnot-date,not-number";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("money parsing", () => {
    it("strips dots from thousands-separated numbers", () => {
      const csv = "NGÀY,CHI TIÊU\n01/06/2024,1.500.000";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amount).toBe(1500000);
    });

    it("strips commas from thousands-separated numbers", () => {
      const csv = "NGÀY,CHI TIÊU\n01/06/2024,\"1,500,000\"";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amount).toBe(1500000);
    });

    it("strips currency symbols and spaces", () => {
      const csv = "NGÀY,CHI TIÊU\n01/06/2024,150.000đ";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amount).toBe(150000);
    });

    it("handles plain integer amounts", () => {
      const csv = "NGÀY,CHI TIÊU\n01/06/2024,99999";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amount).toBe(99999);
    });
  });

  describe("date deduplication", () => {
    it("sums amounts for duplicate dates", () => {
      const csv = [
        "NGÀY,CHI TIÊU",
        "01/06/2024,100000",
        "01/06/2024,200000",
        "01/06/2024,50000",
      ].join("\n");
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].amount).toBe(350000);
    });

    it("keeps separate entries for different dates", () => {
      const csv = [
        "NGÀY,CHI TIÊU",
        "01/06/2024,100000",
        "02/06/2024,200000",
      ].join("\n");
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(2);
    });

    it("does not double-count rows with valid and invalid amounts for same date", () => {
      const csv = [
        "NGÀY,CHI TIÊU",
        "01/06/2024,100000",
        "01/06/2024,", // skipped
        "01/06/2024,50000",
      ].join("\n");
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amount).toBe(150000);
    });
  });

  describe("extra columns", () => {
    it("ignores extra columns like STT, LEAD, F1", () => {
      const csv = "STT,NGÀY,CHI TIÊU,LEAD,F1\n1,01/06/2024,100000,5,2";
      const result = parseCostCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].periodDate).toBe("2024-06-01");
      expect(result.rows[0].amount).toBe(100000);
    });
  });

  describe("BOM handling", () => {
    it("strips UTF-8 BOM from input", () => {
      const bom = "\uFEFF";
      const csv = bom + "NGÀY,CHI TIÊU\n01/06/2024,100000";
      const result = parseCostCsv(csv);
      expect(result.kind).toBe("ok");
    });
  });

  describe("large input", () => {
    it("handles 1000 rows without performance issues", () => {
      const header = "NGÀY,CHI TIÊU";
      const rows = Array.from(
        { length: 1000 },
        (_, i) => `${String(i % 28 + 1).padStart(2, "0")}/06/2024,${(i + 1) * 1000}`,
      );
      const csv = [header, ...rows].join("\n");
      const start = Date.now();
      const result = parseCostCsv(csv);
      const elapsed = Date.now() - start;
      expect(result.kind).toBe("ok");
      expect(elapsed).toBeLessThan(500);
    });
  });
});
