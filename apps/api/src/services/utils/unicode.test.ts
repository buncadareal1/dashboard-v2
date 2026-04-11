import { describe, it, expect } from "vitest";
import {
  normalizeName,
  normalizePhone,
  normalizeEntityName,
  entityLookupKey,
} from "./unicode.js";

describe("normalizeName", () => {
  it("returns empty string for null", () => {
    expect(normalizeName(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeName(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeName("")).toBe("");
  });

  it("removes Vietnamese diacritics", () => {
    expect(normalizeName("Nguyễn Văn A")).toBe("nguyen van a");
  });

  it("converts to lowercase", () => {
    expect(normalizeName("NGUYEN VAN A")).toBe("nguyen van a");
  });

  it("replaces đ/Đ with d", () => {
    expect(normalizeName("Đặng Thị B")).toBe("dang thi b");
    expect(normalizeName("đặng thị b")).toBe("dang thi b");
  });

  it("collapses multiple spaces to single space", () => {
    expect(normalizeName("Nguyen  Van   A")).toBe("nguyen van a");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeName("  Nguyen Van A  ")).toBe("nguyen van a");
  });

  it("handles full Vietnamese name with tones", () => {
    expect(normalizeName("Trần Thị Hương")).toBe("tran thi huong");
  });

  it("handles name with only spaces", () => {
    expect(normalizeName("   ")).toBe("");
  });

  it("handles mixed Vietnamese and latin", () => {
    expect(normalizeName("Lê ABC xyz")).toBe("le abc xyz");
  });
});

describe("normalizePhone", () => {
  it("returns empty string for null", () => {
    expect(normalizePhone(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizePhone(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("converts +84 prefix to 0", () => {
    expect(normalizePhone("+84912345678")).toBe("0912345678");
  });

  it("converts 84 prefix (11 digits) to 0", () => {
    expect(normalizePhone("84912345678")).toBe("0912345678");
  });

  it("does not convert 84 prefix when length < 11", () => {
    // "84123" — only 5 digits, length < 11, kept as-is
    expect(normalizePhone("84123")).toBe("84123");
  });

  it("strips spaces and dashes from phone number", () => {
    expect(normalizePhone("0912 345 678")).toBe("0912345678");
    expect(normalizePhone("0912-345-678")).toBe("0912345678");
  });

  it("strips parentheses", () => {
    expect(normalizePhone("(0912) 345678")).toBe("0912345678");
  });

  it("preserves 0-prefixed numbers as-is", () => {
    expect(normalizePhone("0987654321")).toBe("0987654321");
  });

  it("strips non-digit characters except leading +", () => {
    expect(normalizePhone("+84 912.345.678")).toBe("0912345678");
  });
});

describe("normalizeEntityName", () => {
  it("returns empty string for null", () => {
    expect(normalizeEntityName(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeEntityName(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeEntityName("")).toBe("");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeEntityName("  Campaign Name  ")).toBe("Campaign Name");
  });

  it("collapses multiple internal spaces", () => {
    expect(normalizeEntityName("Campaign  Name   Here")).toBe(
      "Campaign Name Here",
    );
  });

  it("preserves casing", () => {
    expect(normalizeEntityName("MY Campaign 2024")).toBe("MY Campaign 2024");
  });

  it("preserves Vietnamese diacritics (does not strip them)", () => {
    expect(normalizeEntityName("Chiến dịch Hà Nội")).toBe("Chiến dịch Hà Nội");
  });

  it("handles single word", () => {
    expect(normalizeEntityName("Campaign")).toBe("Campaign");
  });
});

describe("entityLookupKey", () => {
  it("returns empty string for null", () => {
    expect(entityLookupKey(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(entityLookupKey(undefined)).toBe("");
  });

  it("returns lowercase version of normalized entity name", () => {
    expect(entityLookupKey("MY Campaign 2024")).toBe("my campaign 2024");
  });

  it("trims and collapses spaces then lowercases", () => {
    expect(entityLookupKey("  Campaign  Name  ")).toBe("campaign name");
  });

  it("preserves Vietnamese characters but lowercases ascii", () => {
    expect(entityLookupKey("Chiến dịch HN")).toBe("chiến dịch hn");
  });

  it("two different-case names produce the same lookup key", () => {
    expect(entityLookupKey("Facebook Campaign")).toBe(
      entityLookupKey("facebook campaign"),
    );
  });
});
