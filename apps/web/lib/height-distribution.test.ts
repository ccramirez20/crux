import { describe, expect, it } from 'vitest';
import type { LeaderboardRound, LeaderboardRow } from './leaderboard';
import { heightDistribution } from './height-distribution';

function fila(registrationId: string, cells: LeaderboardRow['cells']): LeaderboardRow {
  return {
    registrationId,
    athleteId: null,
    athleteName: registrationId,
    bibNumber: null,
    result: {
      format: 'max_height',
      rank: 1,
      tied: false,
      registrationId,
      height: 0,
      top: false,
    },
    cells,
  };
}

function cell(problemId: string, overrides: Partial<LeaderboardRow['cells'][number]> = {}): LeaderboardRow['cells'][number] {
  return { problemId, top: false, topAttempts: null, zone: false, zoneAttempts: null, height: null, ...overrides };
}

function round(rows: LeaderboardRow[]): LeaderboardRound {
  return {
    id: 'round-1',
    type: 'qualification',
    order: 1,
    problems: [{ id: 'p1', number: 1, name: null, topPoints: null, zonePoints: null }],
    problemStats: [],
    rows,
    timeline: [],
    lastAttempts: [],
    error: null,
  };
}

describe('heightDistribution', () => {
  it('reparte a quien no topó en tres tramos relativos a la altura más alta registrada', () => {
    const r = round([
      fila('a', [cell('p1', { top: true })]),
      fila('b', [cell('p1', { height: 100 })]), // referencia: cerca de la cima
      fila('c', [cell('p1', { height: 50 })]), // a mitad de vía
      fila('d', [cell('p1', { height: 20 })]), // parte baja de la ruta
    ]);

    const [p1] = heightDistribution(r);
    expect(p1).toEqual({ problemId: 'p1', mode: 'buckets', buckets: [1, 1, 1] });
  });

  it('cae a top-only con menos de dos alturas registradas entre quienes no toparon', () => {
    const r = round([
      fila('a', [cell('p1', { top: true })]),
      fila('b', [cell('p1', { height: 40 })]),
      fila('c', [cell('p1')]), // sin altura registrada
      fila('d', [cell('p1')]),
    ]);

    expect(heightDistribution(r)).toEqual([{ problemId: 'p1', mode: 'top-only' }]);
  });

  it('empate de alturas cae en el mismo tramo, sin romper', () => {
    const r = round([
      fila('a', [cell('p1', { height: 50 })]),
      fila('b', [cell('p1', { height: 50 })]),
    ]);

    const [p1] = heightDistribution(r);
    expect(p1).toEqual({ problemId: 'p1', mode: 'buckets', buckets: [2, 0, 0] });
  });
});
