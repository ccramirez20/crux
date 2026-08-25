import type { LeaderboardRow } from './leaderboard';

/**
 * Quién va en cada cajón del podio, por `rank` real y no por posición en el
 * arreglo — un empate en oro deja plata y/o bronce vacíos (el ranking los
 * salta), y cualquier cajón puede traer más de una fila si ese puesto
 * también quedó empatado (dos personas en el 3° lugar, por ejemplo).
 */
export function podiumSlots(rows: LeaderboardRow[]) {
  return {
    gold: rows.filter((r) => r.result.rank === 1),
    silver: rows.filter((r) => r.result.rank === 2),
    bronze: rows.filter((r) => r.result.rank === 3),
  };
}
