// Brute-force brake for the judge code. Only *failed* code checks count: a
// judge coming back from a dead zone drains a whole round in one burst, and
// throttling that would lose real captures to protect nothing.
//
// ponytail: fixed window in process memory, no store, no dependency. The
// ceiling is honest — it resets when the server restarts, and with more than
// one instance each gets its own counter, so the real limit is N × MAX_FAILURES.
// Both are fine for one box running one gym's event; move the counter to a
// Postgres table the day this runs on more than one instance.

// Cinco fallos, no diez: el codigo se lee de un papel y se teclea con el pulgar,
// asi que dos o tres errores honestos entran de sobra, y quien va por el cuarto
// ya no lo esta leyendo de ningun papel.
const WINDOW_MS = 5 * 60_000;
const MAX_FAILURES = 5;
const MAX_KEYS = 5_000;

const failures = new Map<string, { count: number; resetAt: number }>();

// Behind a proxy the client IP is the first entry of x-forwarded-for; on the
// LAN dev server nothing sets it and every phone shares the 'local' bucket.
// Deployed it is barely better: one gym wifi is one public IP, so the whole
// judging crew still shares a bucket. That is only acceptable because both
// callers consult this **after** checking the code and only on the failing
// branch — a judge with the right code is never throttled by someone else's
// typing. Keep that order if you touch either route.
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
