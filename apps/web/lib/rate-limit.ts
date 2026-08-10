// Brute-force brake for the judge code. Only *failed* code checks count: a
// judge coming back from a dead zone drains a whole round in one burst, and
// throttling that would lose real captures to protect nothing.
//
// ponytail: fixed window in process memory, no store, no dependency. The
// ceiling is honest — it resets when the server restarts, and with more than
// one instance each gets its own counter, so the real limit is N × MAX_FAILURES.
// Both are fine for one box running one gym's event; move the counter to a
// Postgres table the day this runs on more than one instance.

const WINDOW_MS = 5 * 60_000;
const MAX_FAILURES = 10;
const MAX_KEYS = 5_000;

const failures = new Map<string, { count: number; resetAt: number }>();

// Behind a proxy the client IP is the first entry of x-forwarded-for; on the
// LAN dev server nothing sets it and every phone shares the 'local' bucket.
// That is acceptable precisely because only wrong codes land here.
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'local';
}

export function isRateLimited(key: string): boolean {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) {
    // Sweeping only when the map gets big keeps this O(1) on the normal path
    // and still stops an IP-rotating flood from growing it without bound.
    if (failures.size >= MAX_KEYS) {
      for (const [otherKey, other] of failures) {
        if (other.resetAt <= now) {
          failures.delete(otherKey);
        }
      }
    }
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

// Test seam: the counters live in module state, so a test that doesn't reset
// them leaks into the next one.
export function resetRateLimits(): void {
  failures.clear();
}
