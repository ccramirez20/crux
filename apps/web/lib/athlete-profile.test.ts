import { describe, expect, it } from 'vitest';
import {
  buildAthleteProfile,
  type ProfileRegistrationRow,
} from './athlete-profile';
import type {
  LeaderboardCategory,
  LeaderboardCell,
  LeaderboardPayload,
  LeaderboardRound,
  LeaderboardRow,
} from './leaderboard';

// El puntaje ya está probado en packages/scoring y el armado de la tabla en
// leaderboard.test.ts. Lo que se guarda aquí es la aritmética propia del
// perfil: qué ronda describe el evento, cómo se acumula una carrera, y sobre
// todo la posición relativa, que es donde un error no se nota mirando.

function cell(overrides: Partial<LeaderboardCell> = {}): LeaderboardCell {
  return {
    problemId: 'p1',
    top: false,
    topAttempts: null,
    zone: false,
    zoneAttempts: null,
    height: null,
    ...overrides,
  };
}

function row(registrationId: string, rank: number, cells: LeaderboardCell[] = []): LeaderboardRow {
  return {
    registrationId,
    athleteId: 'ath-1',
    athleteName: 'Ana Ríos',
    bibNumber: '10',
    result: {
      format: 'classic_tops_zones',
      rank,
      tied: false,
      registrationId,
      tops: 0,
      topAttempts: 0,
      zones: 0,
      zoneAttempts: 0,
    },
    cells,
  };
}

function round(overrides: Partial<LeaderboardRound> = {}): LeaderboardRound {
  return {
    id: 'round-clasi',
    type: 'qualification',
    order: 1,
    problems: [{ id: 'p1', number: 1, name: null, topPoints: null, zonePoints: null }],
    rows: [],
    error: null,
    timeline: [],
    problemStats: [],
    ...overrides,
  };
}

/** Un evento con una categoría y las rondas que se le pasen. */
function payload(rounds: LeaderboardRound[], category: Partial<LeaderboardCategory> = {}): LeaderboardPayload {
  return {
    event: {
      name: 'Copa',
      slug: 'copa',
      discipline: 'boulder',
      scoringFormat: 'classic_tops_zones',
      date: null,
      timezone: 'America/Bogota',
    },
    categories: [{ id: 'cat-1', name: 'Open Femenina', rounds, ...category }],
    updatedAt: '2026-08-12T00:00:00Z',
  };
}

function registration(overrides: Partial<ProfileRegistrationRow> = {}): ProfileRegistrationRow {
  return {
    registrationId: 'reg-1',
    categoryId: 'cat-1',
    eventSlug: 'copa',
    eventName: 'Copa Páramo',
    eventDate: '2026-08-22',
    discipline: 'boulder',
    ...overrides,
  };
}

describe('buildAthleteProfile', () => {
  it('describe el evento con la ronda más avanzada en la que apareció', () => {
    const profile = buildAthleteProfile(
      'Ana Ríos',
      [registration()],
      new Map([
        [
          'copa',
          payload([
            round({ id: 'clasi', type: 'qualification', order: 1, rows: [row('reg-1', 8)] }),
            round({ id: 'final', type: 'final', order: 2, rows: [row('reg-1', 2)] }),
          ]),
        ],
      ]),
    );

    expect(profile.events[0]!.roundType).toBe('final');
    expect(profile.events[0]!.rank).toBe(2);
  });

  it('pone un 8.º de 26 por encima de un 3.º de 5', () => {
    // El test que justifica que exista `standing`. Ordenar por puesto crudo
    // invierte estos dos y la pantalla queda mintiendo.
    const big = Array.from({ length: 26 }, (_, i) => row(i === 7 ? 'reg-1' : `otro-${i}`, i + 1));
    const small = Array.from({ length: 5 }, (_, i) => row(i === 2 ? 'reg-1' : `otro-${i}`, i + 1));

    const profile = buildAthleteProfile(
      'Ana Ríos',
      [
        registration({ eventSlug: 'grande', eventName: 'Grande', eventDate: '2026-03-01' }),
        registration({ eventSlug: 'chico', eventName: 'Chico', eventDate: '2026-05-01' }),
      ],
      new Map([
        ['grande', payload([round({ rows: big })])],
        ['chico', payload([round({ rows: small })])],
      ]),
    );

    expect(profile.best.map((e) => e.eventName)).toEqual(['Grande', 'Chico']);
    expect(profile.career.bestRank).toBe(3);
  });

  it('deja la posición relativa en null cuando no hay contra quién medirse', () => {
    const profile = buildAthleteProfile(
      'Ana Ríos',
      [registration()],
      new Map([['copa', payload([round({ rows: [row('reg-1', 1)] })])]]),
    );

    expect(profile.events[0]!.field).toBe(1);
    expect(profile.events[0]!.standing).toBeNull();
    expect(profile.best).toEqual([]);
    expect(profile.trend).toBeNull();
  });

  it('muestra el evento sin puesto cuando la ronda no se pudo puntuar', () => {
    const profile = buildAthleteProfile(
      'Ana Ríos',
      [registration()],
      new Map([['copa', payload([round({ rows: [], error: 'Formato desconocido' })])]]),
    );

    expect(profile.events).toHaveLength(1);
    expect(profile.events[0]!.rank).toBeNull();
    expect(profile.best).toEqual([]);
    expect(profile.career.podiums).toBe(0);
  });

  it('acumula la carrera entre eventos y cuenta el top como zona', () => {
    const cells = [
      cell({ problemId: 'p1', top: true, topAttempts: 1, zone: true, zoneAttempts: 1 }),
      cell({ problemId: 'p2', zone: true, zoneAttempts: 2 }),
      cell({ problemId: 'p3' }),
    ];
    const profile = buildAthleteProfile(
      'Ana Ríos',
      [
        registration({ eventSlug: 'uno', eventDate: '2026-03-01' }),
        registration({ eventSlug: 'dos', eventDate: '2026-05-01' }),
      ],
      new Map([
        ['uno', payload([round({ rows: [row('reg-1', 1, cells), row('otra', 2)] })])],
        ['dos', payload([round({ rows: [row('reg-1', 1, cells), row('otra', 2)] })])],
      ]),
    );

    expect(profile.career.boulder).toEqual({
      problems: 6,
      tops: 2,
      // El top pasa por la zona: 2 zonas por evento, igual que en la tabla.
      zones: 4,
      flashes: 2,
      maxHeight: null,
    });
    expect(profile.career.lead).toBeNull();
    expect(profile.career.podiums).toBe(2);
  });

  it('saca la altura máxima en dificultad y no inventa un cero', () => {
    const profile = buildAthleteProfile(
      'Ana Ríos',
      [registration({ discipline: 'lead' })],
      new Map([
        [
          'copa',
          payload([
            round({
              rows: [
                row('reg-1', 1, [cell({ height: 18.5 }), cell({ problemId: 'p2', height: 22 }), cell({ problemId: 'p3' })]),
                row('otra', 2),
              ],
            }),
          ]),
        ],
      ]),
    );

    expect(profile.career.lead?.maxHeight).toBe(22);
    expect(profile.career.boulder).toBeNull();
  });

  it('compara el último evento con el anterior, y lo dice cuando fue peor', () => {
    const antes = Array.from({ length: 11 }, (_, i) => row(i === 0 ? 'reg-1' : `otro-${i}`, i + 1));
    const despues = Array.from({ length: 11 }, (_, i) => row(i === 10 ? 'reg-1' : `otro-${i}`, i + 1));

    const profile = buildAthleteProfile(
      'Ana Ríos',
      [
        registration({ eventSlug: 'antes', eventName: 'Antes', eventDate: '2026-03-01' }),
        registration({ eventSlug: 'despues', eventName: 'Después', eventDate: '2026-05-01' }),
      ],
      new Map([
        ['antes', payload([round({ rows: antes })])],
        ['despues', payload([round({ rows: despues })])],
      ]),
    );

    expect(profile.trend?.latest.eventName).toBe('Después');
    expect(profile.trend?.previous.eventName).toBe('Antes');
    expect(profile.trend?.delta).toBe(-1);
    // La lista se lee al revés de como se vivió: lo último, primero.
    expect(profile.events.map((e) => e.eventName)).toEqual(['Después', 'Antes']);
  });
});
