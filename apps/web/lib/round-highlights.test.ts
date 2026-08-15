import { describe, expect, it } from 'vitest';
import type { LeaderboardRound } from './leaderboard';
import { roundHighlights } from './round-highlights';

// La tira de la pantalla de proyección se lee de lejos y no tiene a nadie que
// la interprete. Lo que se prueba aquí es el caso que no se puede mirar en la
// semilla —una ronda sin un solo top— porque es exactamente lo que hay en
// pantalla los primeros minutos de cada ronda.
function round(overrides: Partial<LeaderboardRound> = {}): LeaderboardRound {
  return {
    id: 'r1',
    type: 'final',
    order: 1,
    problems: [
      { id: 'p1', number: 1, name: 'Cocuy', topPoints: null, zonePoints: null },
      { id: 'p2', number: 2, name: 'Tolima', topPoints: null, zonePoints: null },
    ],
    rows: [],
    error: null,
    timeline: [],
    problemStats: [],
    lastAttempts: [],
    ...overrides,
  };
}

const row = (registrationId: string) => ({
  registrationId,
  athleteId: registrationId,
  athleteName: registrationId,
  bibNumber: null,
  result: {
    format: 'classic_tops_zones' as const,
    registrationId,
    rank: 1,
    tied: false,
    tops: 0,
    topAttempts: 0,
    zones: 0,
    zoneAttempts: 0,
  },
  cells: [],
});

const stat = (problemId: string, number: number, tops: number) => ({
  problemId,
  number,
  tops,
  zones: 0,
  flashes: 0,
  field: 2,
});

describe('roundHighlights · tops logrados', () => {
  it('sin un solo top lo dice con palabras, no con dos ceros', () => {
    const items = roundHighlights(
      round({
        rows: [row('a'), row('b')],
        problemStats: [stat('p1', 1, 0), stat('p2', 2, 0)],
      }),
      'bloque',
      false,
    );
    const tops = items.find((i) => i.key === 'tops');
    expect(tops?.value).toBe('0%');
    expect(tops?.detail).toBe('Todavía no cae ninguno · 4 posibles en la ronda');
  });

  it('con tops reparte el porcentaje y en cuántos bloques cayó', () => {
    const items = roundHighlights(
      round({
        rows: [row('a'), row('b')],
        problemStats: [stat('p1', 1, 2), stat('p2', 2, 0)],
      }),
      'bloque',
      false,
    );
    const tops = items.find((i) => i.key === 'tops');
    expect(tops?.value).toBe('50%');
    expect(tops?.detail).toBe('2 de 4 posibles · hubo top en 1 de 2 bloques');
  });
});
