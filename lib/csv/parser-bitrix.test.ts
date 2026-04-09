import { describe, it, expect } from "vitest";
import { parseBitrixCsv, BITRIX_REQUIRED_HEADERS } from "./parser-bitrix";

const HEADER = "Lead,Stage,Responsible,Updated Time,Comment";

describe("parseBitrixCsv", () => {
  it("reject CSV thiếu required headers", () => {
    expect(parseBitrixCsv("Foo,Bar\n1,2").kind).toBe("invalid-header");
  });

  it("accept full headers + parse 1 row", () => {
    const csv = `${HEADER}\nNguyễn Văn A,F1 (QT dự án cụ thể),Lê Văn B - Juno,06/02/2026 10:15,Note 1`;
    const result = parseBitrixCsv(csv);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.rows).toHaveLength(1);
  });

  it("normalize name", () => {
    const csv = `${HEADER}\nNguyễn Văn Á,F1,Lê Văn B - Juno,06/02/2026 10:15,note`;
    const result = parseBitrixCsv(csv);
    if (result.kind !== "ok") throw new Error();
    const row = result.rows[0];
    expect(row.fullName).toBe("Nguyễn Văn Á");
    expect(row.fullNameNormalized).toBe("nguyen van a");
  });

  it("strip team suffix khỏi Responsible (Tên - Juno → Tên)", () => {
    const csv = `${HEADER}\nA,F1,Nguyễn Thị Thúy Trang - Juno,06/02/2026 10:15,note`;
    const result = parseBitrixCsv(csv);
    if (result.kind !== "ok") throw new Error();
    const row = result.rows[0];
    expect(row.employeeName).toBe("Nguyễn Thị Thúy Trang");
    expect(row.employeeTeam).toBe("Juno");
    expect(row.employeeNameNormalized).toBe("nguyen thi thuy trang");
  });

  it("Responsible không có team suffix → team = null", () => {
    const csv = `${HEADER}\nA,F1,Nguyễn Văn B,06/02/2026 10:15,note`;
    const result = parseBitrixCsv(csv);
    if (result.kind !== "ok") throw new Error();
    const row = result.rows[0];
    expect(row.employeeName).toBe("Nguyễn Văn B");
    expect(row.employeeTeam).toBeNull();
  });

  it("giữ raw stage (chưa map) — caller dùng resolveStage sau", () => {
    const csv = `${HEADER}\nA,Lead Pending Review,B - Juno,06/02/2026 10:15,note`;
    const result = parseBitrixCsv(csv);
    if (result.kind !== "ok") throw new Error();
    expect(result.rows[0].rawStage).toBe("Lead Pending Review");
  });

  it("parse Updated Time DD/MM/YYYY HH:mm", () => {
    const csv = `${HEADER}\nA,F1,B - Juno,06/02/2026 10:15,note`;
    const result = parseBitrixCsv(csv);
    if (result.kind !== "ok") throw new Error();
    const row = result.rows[0];
    expect(row.bitrixUpdatedAt?.getUTCFullYear()).toBe(2026);
    expect(row.bitrixUpdatedAt?.getUTCMonth()).toBe(1);
    expect(row.bitrixUpdatedAt?.getUTCDate()).toBe(6);
  });

  it("xử lý quoted comment có dấu phẩy", () => {
    const csv = `${HEADER}\nA,F1,B - Juno,06/02/2026 10:15,"khách bận, hẹn gọi lại"`;
    const result = parseBitrixCsv(csv);
    if (result.kind !== "ok") throw new Error();
    expect(result.rows[0].comment).toBe("khách bận, hẹn gọi lại");
  });

  it("BITRIX_REQUIRED_HEADERS chứa Lead, Stage, Responsible", () => {
    expect(BITRIX_REQUIRED_HEADERS).toContain("Lead");
    expect(BITRIX_REQUIRED_HEADERS).toContain("Stage");
    expect(BITRIX_REQUIRED_HEADERS).toContain("Responsible");
  });
});
