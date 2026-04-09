import { describe, it, expect } from "vitest";
import { parseFacebookCsv, FB_REQUIRED_HEADERS } from "./parser-facebook";

const SAMPLE_HEADER =
  "Created Time,DATE CLEAN,Full Name,Phone,Email,Tình trạng,Campaign,Adset,Ad,Form Name,Lead ID,anh/chị_đang_quan_tâm_loại_nhà_phố_nào_ạ_?,custom_2";

describe("parseFacebookCsv", () => {
  it("reject CSV không có required headers", () => {
    const result = parseFacebookCsv("Foo,Bar\n1,2");
    expect(result.kind).toBe("invalid-header");
  });

  it("accept CSV có đầy đủ required headers", () => {
    const csv = `${SAMPLE_HEADER}\n05/02/2026,05/02/2026,Nguyễn Xuân Hưng,84912281616,test@e.com,F1,Camp1,,,,LID-001,Nhà phố,Câu trả lời 2`;
    const result = parseFacebookCsv(csv);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.rows).toHaveLength(1);
    }
  });

  it("normalize name + phone trong row", () => {
    const csv = `${SAMPLE_HEADER}\n05/02/2026,05/02/2026,Nguyễn Văn Á,84972347648,,F1,Camp1,Adset1,Ad1,Form1,LID-001,,`;
    const result = parseFacebookCsv(csv);
    if (result.kind !== "ok") throw new Error("expected ok");
    const row = result.rows[0];
    expect(row.fullName).toBe("Nguyễn Văn Á");
    expect(row.fullNameNormalized).toBe("nguyen van a");
    expect(row.phone).toBe("84972347648");
    expect(row.phoneNormalized).toBe("0972347648");
  });

  it("ignore Tình trạng column từ FB CSV (stage lấy từ Bitrix)", () => {
    const csv = `${SAMPLE_HEADER}\n05/02/2026,05/02/2026,Test User,84912345678,,F1,Camp1,,,,LID-001,,`;
    const result = parseFacebookCsv(csv);
    if (result.kind !== "ok") throw new Error("expected ok");
    // Parser không expose stage — sẽ override bằng Bitrix sau
    expect((result.rows[0] as Record<string, unknown>).stage).toBeUndefined();
  });

  it("extract custom form fields vào formAnswers JSONB", () => {
    const csv = `${SAMPLE_HEADER}\n05/02/2026,05/02/2026,Test,84912345678,,,Camp1,,,,LID-001,Nhà phố cao tầng,Câu trả lời 2 dài`;
    const result = parseFacebookCsv(csv);
    if (result.kind !== "ok") throw new Error("expected ok");
    const row = result.rows[0];
    expect(row.formAnswers).toEqual({
      "anh/chị_đang_quan_tâm_loại_nhà_phố_nào_ạ_?": "Nhà phố cao tầng",
      custom_2: "Câu trả lời 2 dài",
    });
  });

  it("parse fbCreatedAt từ DD/MM/YYYY", () => {
    const csv = `${SAMPLE_HEADER}\n05/02/2026,05/02/2026,Test,84912345678,,,Camp1,,,,LID-001,,`;
    const result = parseFacebookCsv(csv);
    if (result.kind !== "ok") throw new Error("expected ok");
    const row = result.rows[0];
    expect(row.fbCreatedAt?.getUTCFullYear()).toBe(2026);
    expect(row.fbCreatedAt?.getUTCMonth()).toBe(1); // Feb (0-indexed)
    expect(row.fbCreatedAt?.getUTCDate()).toBe(5);
  });

  it("trả Lead ID, Campaign, Adset, Ad, Form Name nguyên xi", () => {
    const csv = `${SAMPLE_HEADER}\n05/02/2026,05/02/2026,Test,84912345678,,,My Campaign,My Adset,My Ad,My Form,FB_999,,`;
    const result = parseFacebookCsv(csv);
    if (result.kind !== "ok") throw new Error("expected ok");
    const row = result.rows[0];
    expect(row.fbLeadId).toBe("FB_999");
    expect(row.campaignName).toBe("My Campaign");
    expect(row.adsetName).toBe("My Adset");
    expect(row.adName).toBe("My Ad");
    expect(row.formName).toBe("My Form");
  });

  it("xử lý nhiều rows", () => {
    const csv = `${SAMPLE_HEADER}\n05/02/2026,05/02/2026,User 1,84111111111,,,Camp1,,,,LID-1,,\n06/02/2026,06/02/2026,User 2,84222222222,,,Camp1,,,,LID-2,,`;
    const result = parseFacebookCsv(csv);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].fbLeadId).toBe("LID-1");
    expect(result.rows[1].fbLeadId).toBe("LID-2");
  });

  it("FB_REQUIRED_HEADERS chứa các cột bắt buộc", () => {
    expect(FB_REQUIRED_HEADERS).toContain("Created Time");
    expect(FB_REQUIRED_HEADERS).toContain("Full Name");
    expect(FB_REQUIRED_HEADERS).toContain("Lead ID");
    expect(FB_REQUIRED_HEADERS).toContain("Campaign");
  });
});
