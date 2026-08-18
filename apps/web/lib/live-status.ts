// ponytail: umbral fijo, no un estado de evento real — no hay en el modelo un
// "esto ya terminó" explícito, así que se infiere de cuánto hace que alguien
// capturó algo. Sube el umbral (o pásalo a una decisión del organizador) si
// una ronda con un receso largo llega a marcarse como terminada por error.
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

export type LiveState = 'not-started' | 'live' | 'settled';

export function liveState(lastActivityAt: string | null, now: Date = new Date()): LiveState {
  if (!lastActivityAt) return 'not-started';
  const elapsed = now.getTime() - Date.parse(lastActivityAt);
  // Una captura "en el futuro" no es reciente, aunque la resta salga negativa
  // y negativa siempre sea <= la ventana. Pasa con datos de siembra fechados
  // adelante, y podría pasar con el reloj de un teléfono mal puesto.
  if (elapsed < 0) return 'settled';
  return elapsed <= LIVE_WINDOW_MS ? 'live' : 'settled';
}
