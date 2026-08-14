import { describe, expect, it } from 'vitest';
import type { Attempt } from '@crux/core';
import { buildLeaderboard, type RegistrationRow, type TreeRow } from './leaderboard';

// The strategies themselves are covered in packages/scoring. What this file
// guards is the wiring: that each round gets the right blocks, the right
// registrations, and the right format.

let counter = 0;
function attempt(overrides: Partial<Attempt> & Pick<Attempt, 'registrationId' | 'problemId' | 'sequence'>): Attempt {
  counter += 1;
  return {
    id: `attempt-${counter}`,
    clientAttemptId: `client-${counter}`,
    judgeLabel: 'juez-1',
    top: false,
    topAttempts: null,
    zone: false,
    zoneAttempts: null,
    height: null,
    capturedAt: new Date('2026-08-10T15:00:00Z'),
    createdAt: new Date('2026-08-10T15:00:00Z'),
    ...overrides,
  };
}

function treeRow(overrides: Partial<TreeRow>): TreeRow {
  return {
    categoryId: 'cat-1',
    categoryName: 'Avanzados',
    roundId: 'round-clasi',
    roundType: 'qualification',
    roundOrder: 1,
    problemId: null,
    problemNumber: null,
    problemName: null,
    problemTopPoints: null,
    problemZonePoints: null,
    ...overrides,
  };
}

const event = {
  name: 'Copa Páramo',
  slug: 'copa-paramo',
  discipline: 'boulder',
  scoringFormat: 'classic_tops_zones',
  date: '2026-08-15',
  timezone: 'America/Bogota',
};

// Two rounds in one category: qualification has blocks 1 and 2, the final has
// its own block 1.
const tree: TreeRow[] = [
  treeRow({ problemId: 'p1', problemNumber: 1 }),
  treeRow({ problemId: 'p2', problemNumber: 2 }),
  treeRow({ roundId: 'round-final', roundType: 'final', roundOrder: 2, problemId: 'pf', problemNumber: 1 }),
];

const registrations: RegistrationRow[] = [
  { id: 'reg-ana', bibNumber: '10', categoryId: 'cat-1', athleteId: 'ath-ana', athleteFullName: 'Ana Ríos' },
  { id: 'reg-beto', bibNumber: '11', categoryId: 'cat-1', athleteId: 'ath-beto', athleteFullName: 'Beto Cano' },
];

function qualification(attempts: Attempt[]) {
  const payload = buildLeaderboard(event, tree, registrations, attempts);
  return payload.categories[0]!.rounds.find((r) => r.id === 'round-clasi')!;
}

describe('buildLeaderboard', () => {
  it('pone al inscrito sin intentos de último y en cero, no lo esconde', () => {
    const round = qualification([
      attempt({ registrationId: 'reg-ana', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ]);

    expect(round.rows.map((r) => r.athleteName)).toEqual(['Ana Ríos', 'Beto Cano']);
    const beto = round.rows[1]!;
    expect(beto.result.rank).toBe(2);
    expect(beto.cells).toEqual([]);
    if (beto.result.format !== 'classic_tops_zones') throw new Error('formato inesperado');
    expect(beto.result.tops).toBe(0);
  });

  it('deja que una corrección posterior reemplace al intento que arregla', () => {
    const round = qualification([
      attempt({ registrationId: 'reg-ana', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      // El juez se equivocó: no fue top, solo zona.
      attempt({ registrationId: 'reg-ana', problemId: 'p1', sequence: 2, zone: true, zoneAttempts: 3 }),
    ]);

    const ana = round.rows.find((r) => r.registrationId === 'reg-ana')!;
    if (ana.result.format !== 'classic_tops_zones') throw new Error('formato inesperado');
    expect(ana.result.tops).toBe(0);
    expect(ana.result.zones).toBe(1);
    expect(ana.result.zoneAttempts).toBe(3);
    expect(ana.cells).toHaveLength(1);
    expect(ana.cells[0]).toMatchObject({ problemId: 'p1', top: false, zone: true });
  });

  it('no deja que el bloque de la final cuente en la clasificatoria', () => {
    const attempts = [
      attempt({ registrationId: 'reg-beto', problemId: 'pf', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const payload = buildLeaderboard(event, tree, registrations, attempts);
    const [clasi, final] = payload.categories[0]!.rounds;

    const betoEnClasi = clasi!.rows.find((r) => r.registrationId === 'reg-beto')!;
    if (betoEnClasi.result.format !== 'classic_tops_zones') throw new Error('formato inesperado');
    expect(betoEnClasi.result.tops).toBe(0);
    expect(betoEnClasi.cells).toEqual([]);

    const betoEnFinal = final!.rows.find((r) => r.registrationId === 'reg-beto')!;
    if (betoEnFinal.result.format !== 'classic_tops_zones') throw new Error('formato inesperado');
    expect(betoEnFinal.result.tops).toBe(1);
  });

  it('reporta un formato de puntaje desconocido en vez de reventar', () => {
    const payload = buildLeaderboard(
      { ...event, scoringFormat: 'formato_que_no_existe' },
      tree,
      registrations,
      [],
    );

    const round = payload.categories[0]!.rounds[0]!;
    expect(round.error).toContain('formato_que_no_existe');
    expect(round.rows).toEqual([]);
  });

  it('reconstruye el adelantamiento re-puntuando la ronda bloque por bloque', () => {
    // Beto topa el primer bloque y Ana solo llega a la zona; en el segundo Ana
    // topa y Beto no. El eje es el bloque, igual para los dos: al cierre del
    // primero manda Beto, al cierre del segundo manda Ana por menos intentos.
    const round = qualification([
      attempt({ registrationId: 'reg-beto', problemId: 'p1', sequence: 1, top: true, topAttempts: 3 }),
      attempt({ registrationId: 'reg-ana', problemId: 'p1', sequence: 2, zone: true, zoneAttempts: 2 }),
      attempt({ registrationId: 'reg-ana', problemId: 'p2', sequence: 3, top: true, topAttempts: 1 }),
    ]);

    const [first, last] = round.timeline;
    expect(round.timeline.map((p) => p.problemNumber)).toEqual([1, 2]);
    expect(first!.ranks['reg-beto']).toBe(1);
    expect(last!.ranks['reg-ana']).toBe(1);
    expect(last!.ranks['reg-beto']).toBe(2);
    // Los intentos siguen ahí como información de apoyo, ya no como eje.
    expect(last!.attempts).toBe(3);
  });

  it('no pone en el eje un bloque que nadie ha escalado todavía', () => {
    const round = qualification([
      attempt({ registrationId: 'reg-ana', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      attempt({ registrationId: 'reg-beto', problemId: 'p1', sequence: 2, zone: true, zoneAttempts: 1 }),
    ]);

    expect(round.timeline.map((p) => p.problemNumber)).toEqual([1]);
  });

  it('mide la dificultad de cada bloque por lo que hizo el campo, sin contar el top como zona', () => {
    const round = qualification([
      attempt({ registrationId: 'reg-ana', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      attempt({ registrationId: 'reg-beto', problemId: 'p1', sequence: 2, zone: true, zoneAttempts: 2 }),
    ]);

    const p1 = round.problemStats.find((s) => s.problemId === 'p1')!;
    expect(p1).toMatchObject({ tops: 1, zones: 1, field: 2 });
    // Nadie tocó el segundo bloque: sigue en la gráfica, en cero.
    expect(round.problemStats.find((s) => s.problemId === 'p2')).toMatchObject({ tops: 0, zones: 0, field: 2 });
  });

  it('no inventa un podio en una ronda que todavía no tiene bloques', () => {
    const payload = buildLeaderboard(event, [treeRow({})], registrations, []);

    const round = payload.categories[0]!.rounds[0]!;
    expect(round.problems).toEqual([]);
    expect(round.rows).toEqual([]);
    expect(round.error).toBeNull();
  });
});
