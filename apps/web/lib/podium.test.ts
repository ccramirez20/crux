import { describe, expect, it } from 'vitest';
import type { LeaderboardRow } from './leaderboard';
import { podiumSlots } from './podium';

// Solo importan puesto y empate: podiumSlots decide por `rank`, nada más.
function fila(registrationId: string, rank: number, tied = false): LeaderboardRow {
  return {
    registrationId,
    athleteId: null,
    athleteName: registrationId,
    bibNumber: null,
    result: {
      format: 'classic_tops_zones',
      rank,
      tied,
      registrationId,
      tops: 0,
      topAttempts: 0,
      zones: 0,
      zoneAttempts: 0,
    },
    cells: [],
  };
}

describe('podiumSlots', () => {
  it('sin empate, un nombre por cajón', () => {
    const rows = [fila('a', 1), fila('b', 2), fila('c', 3), fila('d', 4)];
    const slots = podiumSlots(rows);
    expect(slots.gold.map((r) => r.registrationId)).toEqual(['a']);
    expect(slots.silver.map((r) => r.registrationId)).toEqual(['b']);
    expect(slots.bronze.map((r) => r.registrationId)).toEqual(['c']);
  });

  it('empate de dos en oro salta la plata: bronce sigue en su puesto real', () => {
    const rows = [fila('a', 1, true), fila('b', 1, true), fila('c', 3), fila('d', 4)];
    const slots = podiumSlots(rows);
    expect(slots.gold.map((r) => r.registrationId)).toEqual(['a', 'b']);
    expect(slots.silver).toEqual([]);
    expect(slots.bronze.map((r) => r.registrationId)).toEqual(['c']);
  });

  it('empate de cuatro en oro deja plata y bronce vacíos', () => {
    const rows = [fila('a', 1, true), fila('b', 1, true), fila('c', 1, true), fila('d', 1, true)];
    const slots = podiumSlots(rows);
    expect(slots.gold.map((r) => r.registrationId)).toEqual(['a', 'b', 'c', 'd']);
    expect(slots.silver).toEqual([]);
    expect(slots.bronze).toEqual([]);
  });

  it('empate de dos en oro, y el bronce (puesto 3) también empatado entre dos', () => {
    const rows = [fila('a', 1, true), fila('b', 1, true), fila('c', 3, true), fila('d', 3, true), fila('e', 5)];
    const slots = podiumSlots(rows);
    expect(slots.gold.map((r) => r.registrationId)).toEqual(['a', 'b']);
    expect(slots.silver).toEqual([]);
    expect(slots.bronze.map((r) => r.registrationId)).toEqual(['c', 'd']);
  });
});
