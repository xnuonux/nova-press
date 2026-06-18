/**
 * a tiny in-memory fixed-window rate limiter.
 *
 * best-effort, per-instance (resets on cold start, doesn't share across
 * serverless instances) ... enough to kill a single-source scripted loop on an
 * anonymous endpoint without standing up redis. the real ceiling for abuse is a
 * shared limiter (lunari's rate_limits / upstash) + double opt-in; this is the
 * basic gate that ships now. `now` is injectable so it's unit-testable.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
// bound the map so a flood of distinct keys can't grow it without limit.
const MAX_KEYS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: Math.max(0, bucket.resetAt - now) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// test-only: drop all state between cases.
export function __resetRateLimit(): void {
  buckets.clear();
}
