import { describe, it, expect } from "vitest";
import { parseFacebookCsv, FB_REQUIRED_HEADERS } from "./parser-facebook.js";

/** Build a minimal valid Facebook CSV string from a list of row objects */
function buildFbCsv(rows: Record<string, string>[], extraHeaders: string[] = []): string {
  const headers = [...FB_REQUIRED_HEADERS, ...extraHeaders];
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => row[h] ?? "").join(","),
  );
  return [headerLine, ...dataLines].join("\n");
}

const baseRow: Record<string, string> = {
  "Created Time": "01/01/2024",
  "DATE CLEAN": "01/01/2024",
  "Full Name": "Nguyen Van A",
  Phone: "0912345678",
  Email: "test@example.com",
  Campaign: "Campaign 1",
  Adset: "Adset 1",
  Ad: "Ad 1",
  "Form Name": "Form 1",
  "Lead ID": "fb-lead-001",
};

describe("parseFacebookCsv", () => {
  describe("invalid-header cases", () => {
    it("returns invalid-header when CSV has no headers at all", () => {
      const result = parseFacebookCsv(",,,,\n1,2,3,4,5");
      expect(result.kind).toBe("invalid-header");
    });

    it("returns invalid-header listing all missing required columns", () => {
      const csv = "Full Name,Phone\nNguyen Van A,0912345678";
      const result = parseFacebookCsv(csv);
      expect(result.kind).toBe("invalid-header");
      if (result.kind !== "invalid-header") throw new Error();
      expect(result.missing).toContain("Created Time");
      expect(result.missing).toContain("Lead ID");
      expect(result.missing).not.toContain("Full Name");
      expect(result.missing).not.toContain("Phone");
    });

    it("returns parse-error or invalid-header for completely empty string", () => {
      const result = parseFacebookCsv("");
      // papaparse may return a parse-error for empty input before header check
      expect(["parse-error", "invalid-header"]).toContain(result.kind);
    });
  });

  describe("ok cases — basic parsing", () => {
    it("returns ok with correct row count", () => {
      const csv = buildFbCsv([baseRow, { ...baseRow, "Lead ID": "fb-002" }]);
      const result = parseFacebookCsv(csv);
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") throw new Error();
      expect(result.rows).toHaveLength(2);
    });

    it("normalizes fullName", () => {
      const csv = buildFbCsv([{ ...baseRow, "Full Name": "Nguyễn Văn A" }]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].fullName).toBe("Nguyễn Văn A");
      expect(result.rows[0].fullNameNormalized).toBe("nguyen van a");
    });

    it("normalizes phone", () => {
      const csv = buildFbCsv([{ ...baseRow, Phone: "+84912345678" }]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].phoneNormalized).toBe("0912345678");
    });

    it("sets phone and phoneNormalized to null when phone is empty", () => {
      const csv = buildFbCsv([{ ...baseRow, Phone: "" }]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].phone).toBeNull();
      expect(result.rows[0].phoneNormalized).toBeNull();
    });

    it("sets email to null when empty", () => {
      const csv = buildFbCsv([{ ...baseRow, Email: "" }]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].email).toBeNull();
    });

    it("parses fbLeadId correctly", () => {
      const csv = buildFbCsv([baseRow]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].fbLeadId).toBe("fb-lead-001");
    });

    it("normalizes campaign/adset/ad/formName entity names", () => {
      const csv = buildFbCsv([
        { ...baseRow, Campaign: "  My Campaign  ", Adset: "My  Adset" },
      ]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].campaignName).toBe("My Campaign");
      expect(result.rows[0].adsetName).toBe("My Adset");
    });

    it("sets campaignName to null when Campaign column is empty", () => {
      const csv = buildFbCsv([{ ...baseRow, Campaign: "" }]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].campaignName).toBeNull();
    });
  });

  describe("date parsing", () => {
    it("parses date in DD/MM/YYYY format", () => {
      const csv = buildFbCsv([{ ...baseRow, "Created Time": "15/06/2023" }]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      const d = result.rows[0].fbCreatedAt;
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2023);
      expect(d!.getUTCMonth()).toBe(5); // June = 5
      expect(d!.getUTCDate()).toBe(15);
    });

    it("parses date with time component", () => {
      const csv = buildFbCsv([
        { ...baseRow, "Created Time": "15/06/2023 14:30" },
      ]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      const d = result.rows[0].fbCreatedAt;
      expect(d!.getUTCHours()).toBe(14);
      expect(d!.getUTCMinutes()).toBe(30);
    });

    it("returns null fbCreatedAt for invalid date string", () => {
      const csv = buildFbCsv([{ ...baseRow, "Created Time": "not-a-date" }]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].fbCreatedAt).toBeNull();
    });
  });

  describe("spent column", () => {
    it("parses Amount spent (VND) column as number", () => {
      const csv = buildFbCsv(
        [{ ...baseRow, "Amount spent (VND)": "150000" }],
        ["Amount spent (VND)"],
      );
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amountSpent).toBe(150000);
    });

    it("parses spent — dot-separated values are parsed by parseFloat (1.500.000 → 1.5)", () => {
      // The implementation uses parseFloat after stripping non-digit/dot/dash chars.
      // "1.500.000" → parseFloat("1.500.000") = 1.5 (JS parseFloat behavior).
      // This documents the current behavior; comma-separated large numbers work correctly.
      const csv = buildFbCsv(
        [{ ...baseRow, "Amount spent (VND)": "1.500.000" }],
        ["Amount spent (VND)"],
      );
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      // parseFloat("1.500.000") in JS = 1.5
      expect(result.rows[0].amountSpent).toBe(1.5);
    });

    it("returns null amountSpent when no spent column present", () => {
      const csv = buildFbCsv([baseRow]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amountSpent).toBeNull();
    });

    it("returns null amountSpent when spent column is empty", () => {
      const csv = buildFbCsv(
        [{ ...baseRow, "Amount spent (VND)": "" }],
        ["Amount spent (VND)"],
      );
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amountSpent).toBeNull();
    });

    it("accepts 'Spend' as alternative spent column header", () => {
      const csv = buildFbCsv(
        [{ ...baseRow, Spend: "50000" }],
        ["Spend"],
      );
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].amountSpent).toBe(50000);
    });
  });

  describe("stage column", () => {
    it("parses rawStage from 'Tình trạng' column", () => {
      const csv = buildFbCsv(
        [{ ...baseRow, "Tình trạng": "Đã mua" }],
        ["Tình trạng"],
      );
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].rawStage).toBe("Đã mua");
    });

    it("returns null rawStage when no stage column present", () => {
      const csv = buildFbCsv([baseRow]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].rawStage).toBeNull();
    });
  });

  describe("formAnswers (extra columns)", () => {
    it("captures unknown columns as formAnswers", () => {
      const csv = buildFbCsv(
        [{ ...baseRow, "Địa chỉ": "Hà Nội", "Ghi chú": "Test" }],
        ["Địa chỉ", "Ghi chú"],
      );
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].formAnswers["Địa chỉ"]).toBe("Hà Nội");
      expect(result.rows[0].formAnswers["Ghi chú"]).toBe("Test");
    });

    it("omits empty extra column values from formAnswers", () => {
      const csv = buildFbCsv(
        [{ ...baseRow, "Địa chỉ": "" }],
        ["Địa chỉ"],
      );
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows[0].formAnswers["Địa chỉ"]).toBeUndefined();
    });

    it("does not include known columns in formAnswers", () => {
      const csv = buildFbCsv([baseRow]);
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(Object.keys(result.rows[0].formAnswers)).not.toContain("Full Name");
      expect(Object.keys(result.rows[0].formAnswers)).not.toContain("Phone");
    });
  });

  describe("BOM handling", () => {
    it("strips UTF-8 BOM from input", () => {
      const bom = "\uFEFF";
      const csv = bom + buildFbCsv([baseRow]);
      const result = parseFacebookCsv(csv);
      expect(result.kind).toBe("ok");
    });
  });

  describe("empty rows", () => {
    it("returns empty rows array for header-only CSV", () => {
      const csv = FB_REQUIRED_HEADERS.join(",");
      const result = parseFacebookCsv(csv);
      if (result.kind !== "ok") throw new Error(result.kind);
      expect(result.rows).toHaveLength(0);
    });
  });
});
