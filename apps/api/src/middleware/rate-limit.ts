/**
 * In-memory rate limiter per key with periodic cleanup.
 * PM2 cluster mode: each instance has its own Map — effective limit is limit×N.
 * Acceptable for internal tool; switch to Redis if precision needed.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup — evict expired entries every 60s to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
}, 60_000).unref(); // unref() so it doesn't prevent process exit

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count++;
  if (entry.count > limit) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: limit - entry.count };
}
