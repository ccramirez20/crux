import type { LeaderboardRound, LeaderboardRow } from './leaderboard';

/**
 * Tops y los intentos que costaron, desde los intentos crudos de la ronda
 * (`row.cells`) y no del resultado puntuado — funciona para cualquier
 * formato de boulder, porque el top en sí no depende de cómo se puntúe la
 * ronda (es la misma fuente que ya usa `problemStats`, por eso el muro de
 * bloques sí funciona en IFSC). `max_height` (lead) no tiene "top" repetible
 * en este sentido, así que se excluye aquí.
 *
 * Solo tipos de `./leaderboard`, nada de su runtime: este módulo lo importan
 * componentes cliente (`leaderboard-charts.tsx`, `projection-screen.tsx`), y
 * `leaderboard.ts` carga `@crux/db`/postgres al importarlo en serio — eso
 * reventaba el build del navegador con "Can't resolve 'net'/'tls'/'fs'".
 */
export function topSummary(row: LeaderboardRow): { tops: number; topAttempts: number } | null {
  if (row.result.format === 'max_height') {
    return null;
  }
  const topped = row.cells.filter((cell) => cell.top);
  return {
    tops: topped.length,
    topAttempts: topped.reduce((sum, cell) => sum + (cell.topAttempts ?? 1), 0),
  };
}

/**
 * Mismo criterio en las dos pantallas a propósito: que la tabla pública y la
 * de proyección discrepen sobre si esta gráfica existe para una ronda es
 * peor que cualquiera de los dos criterios.
 */
export function hasAttemptsPerTop(round: LeaderboardRound, minTops = 2, minClimbers = 2): boolean {
  return round.rows.filter((r) => (topSummary(r)?.tops ?? 0) >= minTops).length >= minClimbers;
}
