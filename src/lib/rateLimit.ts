// Simple in-memory fixed-window rate limiter. Sufficient for a personal,
// single-household app. Note: state is per server instance (resets on redeploy
// / cold start) — that's an acceptable tradeoff here, not a security boundary.
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count += 1;
  return true;
}
