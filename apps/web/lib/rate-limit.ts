// Freno por IP. Dos usos hoy, con ventanas distintas:
//
// - Código de juez: solo cuentan los intentos **fallidos**. Un juez que vuelve
//   de una zona muerta drena una ronda entera de golpe, y frenar eso perdería
//   capturas reales para no proteger nada.
// - Inscripción pública: cuenta cada inscripción creada. Ahí no hay código que
//   fallar — el enlace es público a propósito — así que lo único que se puede
//   limitar es cuántas caben por IP.
//
// ponytail: ventana fija en memoria del proceso, sin store y sin dependencia.
// El techo es honesto — se reinicia con el servidor, y con más de una instancia
// cada una lleva su propio conteo, así que el límite real es N × max. Ambas
// cosas están bien para una caja corriendo el evento de un gimnasio; el día que
// esto corra en más de una instancia, el contador se muda a una tabla de
// Postgres.

// Cinco fallos, no diez: el codigo se lee de un papel y se teclea con el pulgar,
// asi que dos o tres errores honestos entran de sobra, y quien va por el cuarto
// ya no lo esta leyendo de ningun papel.
const WINDOW_MS = 5 * 60_000;
const MAX_FAILURES = 5;
const MAX_KEYS = 5_000;

// La inscripción se mide más ancha y más larga porque el caso real que no se
// puede romper es el entrenador inscribiendo a su equipo desde un solo teléfono
// en la wifi del gimnasio: veinte seguidas es gente, no un script. Un flood
// automatizado igual queda topado en 20 cada diez minutos por IP, y ahora el
// organizador tiene con qué limpiar lo que entre.
export const REGISTRATION_WINDOW_MS = 10 * 60_000;
export const REGISTRATION_MAX = 20;

const hits = new Map<string, { count: number; resetAt: number }>();

// Behind a proxy the client IP is the first entry of x-forwarded-for; on the
// LAN dev server nothing sets it and every phone shares the 'local' bucket.
// Deployed it is barely better: one gym wifi is one public IP, so the whole
// judging crew still shares a bucket. That is only acceptable because the two
// judge callers consult this **after** checking the code and only on the failing
// branch — a judge with the right code is never throttled by someone else's
// typing. Keep that order if you touch either route.
//
// Recibe `Headers` y no `Request`: la inscripción pública es una server action,
// donde lo que hay es `await headers()` y no hay `Request` ninguno. Una sola
// forma de leer la IP para todos los bordes.
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'local';
}

export function isRateLimited(key: string, max: number = MAX_FAILURES): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    return false;
  }
  return entry.count >= max;
}

export function recordAttempt(key: string, windowMs: number = WINDOW_MS): void {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    // Sweeping only when the map gets big keeps this O(1) on the normal path
    // and still stops an IP-rotating flood from growing it without bound.
    if (hits.size >= MAX_KEYS) {
      for (const [otherKey, other] of hits) {
        if (other.resetAt <= now) {
          hits.delete(otherKey);
        }
      }
    }
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
}

// Test seam: the counters live in module state, so a test that doesn't reset
// them leaks into the next one.
export function resetRateLimits(): void {
  hits.clear();
}
