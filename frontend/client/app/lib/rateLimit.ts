// Minimal in-memory rate limiter (per-process; resets on restart). Good
// enough to blunt brute-force attempts on a single-instance deployment.
type Entry = { count: number; windowStart: number };

const buckets = new Map<string, Entry>();

export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= maxAttempts,
    remaining: Math.max(0, maxAttempts - entry.count),
  };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}
