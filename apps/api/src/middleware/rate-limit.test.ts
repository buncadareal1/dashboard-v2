import { describe, it, expect, beforeEach } from "vitest";

/**
 * The rateLimit function uses a module-level Map for state.
 * We re-import the module fresh each test by using a unique key prefix,
 * OR we reset state between tests using the module's own internal Map.
 *
 * Since we cannot directly reset the Map, we use unique keys per test
 * to simulate isolation.
 */

let counter = 0;
function uniqueKey(base: string): string {
  return `${base}-${++counter}`;
}

describe("rateLimit", () => {
  // Import inline to ensure fresh module each describe block if needed.
  // Since vitest uses ESM, we import at top-level and use unique keys for isolation.

  it("imports correctly", async () => {
    const mod = await import("./rate-limit.js");
    expect(mod.rateLimit).toBeTypeOf("function");
  });

  it("returns ok:true on first call", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("first");
    const result = rateLimit(key, 5, 60_000);
    expect(result.ok).toBe(true);
  });

  it("returns remaining = limit - 1 on first call", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("remaining-first");
    const result = rateLimit(key, 10, 60_000);
    expect(result.remaining).toBe(9);
  });

  it("decrements remaining on each call", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("decrement");
    rateLimit(key, 5, 60_000); // 1st call
    rateLimit(key, 5, 60_000); // 2nd call
    const result = rateLimit(key, 5, 60_000); // 3rd call
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(2); // 5 - 3 = 2
  });

  it("returns ok:true up to and including the limit call", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("at-limit");
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      const r = rateLimit(key, limit, 60_000);
      expect(r.ok).toBe(true);
    }
  });

  it("returns ok:false and remaining:0 when limit is exceeded", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("exceeded");
    const limit = 3;
    // exhaust the limit
    for (let i = 0; i < limit; i++) {
      rateLimit(key, limit, 60_000);
    }
    // one more call exceeds the limit
    const result = rateLimit(key, limit, 60_000);
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("continues returning ok:false after limit exceeded", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("stay-exceeded");
    const limit = 2;
    for (let i = 0; i < limit + 5; i++) {
      rateLimit(key, limit, 60_000);
    }
    const result = rateLimit(key, limit, 60_000);
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets window after windowMs has elapsed", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("window-reset");
    const limit = 2;
    // Use a negative windowMs so resetAt is in the past, guaranteeing expiry on next call.
    // windowMs=-1 → resetAt = Date.now() - 1, so Date.now() > resetAt immediately.
    for (let i = 0; i < limit + 1; i++) {
      rateLimit(key, limit, -1);
    }
    // next call sees expired window (now > resetAt) and resets
    const result = rateLimit(key, limit, 60_000);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  it("different keys are tracked independently", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const keyA = uniqueKey("independent-a");
    const keyB = uniqueKey("independent-b");
    const limit = 2;

    // exhaust keyA
    for (let i = 0; i < limit + 1; i++) {
      rateLimit(keyA, limit, 60_000);
    }
    expect(rateLimit(keyA, limit, 60_000).ok).toBe(false);

    // keyB should be completely fresh
    const resultB = rateLimit(keyB, limit, 60_000);
    expect(resultB.ok).toBe(true);
    expect(resultB.remaining).toBe(limit - 1);
  });

  it("limit of 1 allows exactly one call before blocking", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("limit-1");
    const first = rateLimit(key, 1, 60_000);
    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(0);

    const second = rateLimit(key, 1, 60_000);
    expect(second.ok).toBe(false);
  });

  it("remaining never goes below 0", async () => {
    const { rateLimit } = await import("./rate-limit.js");
    const key = uniqueKey("no-negative");
    const limit = 1;
    rateLimit(key, limit, 60_000); // 1st — ok
    rateLimit(key, limit, 60_000); // 2nd — exceeded
    rateLimit(key, limit, 60_000); // 3rd — exceeded
    const result = rateLimit(key, limit, 60_000);
    expect(result.remaining).toBe(0);
  });
});
