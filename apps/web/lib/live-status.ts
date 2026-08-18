// ponytail: umbral fijo, no un estado de evento real — no hay en el modelo un
// "esto ya terminó" explícito, así que se infiere de cuánto hace que alguien
// capturó algo. Sube el umbral (o pásalo a una decisión del organizador) si
// una ronda con un receso largo llega a marcarse como terminada por error.
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

export function isLive(lastActivityAt: string | null, now: Date = new Date()): boolean {
  if (!lastActivityAt) return false;
  return now.getTime() - Date.parse(lastActivityAt) <= LIVE_WINDOW_MS;
}
