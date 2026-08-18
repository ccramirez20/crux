import { describe, expect, it } from 'vitest';
import { buildLeaderboardCsv } from './csv-export';
import type { LeaderboardPayload } from './leaderboard';

function payload(overrides: Partial<LeaderboardPayload> = {}): LeaderboardPayload {
  return {
    event: {
      name: 'Liga Páramo',
      slug: 'liga-paramo',
      discipline: 'boulder',
      scoringFormat: 'classic_tops_zones',
      date: '2026-08-22',
      timezone: 'America/Bogota',
      organizationLogo: null,
    },
    categories: [],
    updatedAt: '2026-08-18T00:00:00.000Z',
    lastActivityAt: null,
    ...overrides,
  };
}

describe('buildLeaderboardCsv', () => {
  it('aplana categoría/ronda/competidor/bloque, una fila por bloque', () => {
    const csv = buildLeaderboardCsv(
      payload({
        categories: [
          {
            id: 'cat-1',
            name: 'Open, Nombre con "comillas", y coma',
            rounds: [
              {
                id: 'round-1',
                type: 'qualification',
                order: 1,
                error: null,
                timeline: [],
                problemStats: [],
                lastAttempts: [],
                problems: [
                  { id: 'p1', number: 1, name: null, topPoints: null, zonePoints: null },
                  { id: 'p2', number: 2, name: null, topPoints: null, zonePoints: null },
                ],
                rows: [
                  {
                    registrationId: 'reg-1',
                    athleteId: 'ath-1',
                    athleteName: 'Valentina Ocampo',
                    bibNumber: '12',
                    result: {
                      format: 'classic_tops_zones',
                      rank: 1,
                      tied: false,
                      registrationId: 'reg-1',
                      tops: 2,
                      topAttempts: 3,
                      zones: 2,
                      zoneAttempts: 2,
                    },
                    cells: [
                      { problemId: 'p1', top: true, topAttempts: 1, zone: true, zoneAttempts: 1, height: null },
                      { problemId: 'p2', top: true, topAttempts: 2, zone: true, zoneAttempts: 1, height: null },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 bloques
    expect(lines[0]).toContain('Categoría');
    expect(lines[1]).toBe(
      '"Open, Nombre con ""comillas"", y coma",Clasificatoria,1,No,12,Valentina Ocampo,1,Sí,1,Sí,1,,2,3,2,2,,,',
    );
    expect(lines[2]).toBe(
      '"Open, Nombre con ""comillas"", y coma",Clasificatoria,1,No,12,Valentina Ocampo,2,Sí,2,Sí,1,,2,3,2,2,,,',
    );
  });

  it('deja vacías las columnas de puntaje que no aplican al formato de la ronda', () => {
    const csv = buildLeaderboardCsv(
      payload({
        categories: [
          {
            id: 'cat-1',
            name: 'Open',
            rounds: [
              {
                id: 'round-1',
                type: 'final',
                order: 1,
                error: null,
                timeline: [],
                problemStats: [],
                lastAttempts: [],
                problems: [],
                rows: [
                  {
                    registrationId: 'reg-1',
                    athleteId: 'ath-1',
                    athleteName: 'Camilo Rueda',
                    bibNumber: null,
                    result: {
                      format: 'league_points',
                      rank: 3,
                      tied: true,
                      registrationId: 'reg-1',
                      score: 640,
                    },
                    cells: [],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Open,Final,3,Sí,,Camilo Rueda,,,,,,,,,,,640,,');
  });
});
