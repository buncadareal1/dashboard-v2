import { describe, it, expect } from "vitest";
import { normalizeName, normalizePhone } from "./unicode";

describe("normalizeName", () => {
  it("xử lý chuỗi rỗng và null/undefined", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });

  it("bỏ dấu tiếng Việt", () => {
    expect(normalizeName("Nguyễn Văn Á")).toBe("nguyen van a");
    expect(normalizeName("Trần Thị Bé")).toBe("tran thi be");
    expect(normalizeName("Đỗ Mạnh Hùng")).toBe("do manh hung");
  });

  it("xử lý đ/Đ → d", () => {
    expect(normalizeName("Đan Phượng")).toBe("dan phuong");
    expect(normalizeName("đường đỗ")).toBe("duong do");
  });

  it("lowercase + trim + collapse spaces", () => {
    expect(normalizeName("  TRẦN  THỊ  Bé  ")).toBe("tran thi be");
    expect(normalizeName("HOÀNG\tMINH")).toBe("hoang minh");
  });

  it("giữ nguyên ký tự không dấu", () => {
    expect(normalizeName("Nam Tran")).toBe("nam tran");
    expect(normalizeName("Le huy minh")).toBe("le huy minh");
  });

  it("xử lý case khác nhau cho cùng tên — match được", () => {
    expect(normalizeName("Le huy minh")).toBe(normalizeName("Le Huy Minh"));
    expect(normalizeName("Hung Hoang")).toBe(normalizeName("Hùng Hoàng"));
  });
});

describe("normalizePhone", () => {
  it("xử lý chuỗi rỗng và null", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });

  it("bỏ ký tự không phải số", () => {
    expect(normalizePhone("0912.345.678")).toBe("0912345678");
    expect(normalizePhone("0912-345-678")).toBe("0912345678");
    expect(normalizePhone("(091) 234 5678")).toBe("0912345678");
  });

  it("+84 → 0", () => {
    expect(normalizePhone("+84912345678")).toBe("0912345678");
    expect(normalizePhone("+84 912 345 678")).toBe("0912345678");
  });

  it("84 prefix → 0 (Facebook export thường có dạng 84xxx)", () => {
    expect(normalizePhone("84912345678")).toBe("0912345678");
    expect(normalizePhone("84972347648")).toBe("0972347648");
  });

  it("giữ nguyên 0 prefix", () => {
    expect(normalizePhone("0912345678")).toBe("0912345678");
  });

  it("không nhầm 84xxx ngắn", () => {
    // 84123 chỉ 5 ký tự — không phải SĐT VN, không strip prefix
    expect(normalizePhone("84123")).toBe("84123");
  });
});
