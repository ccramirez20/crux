import { describe, expect, it } from 'vitest';
import { deriveShareCard } from './share-card';
import type { AthleteEventResult, AthleteProfile, DisciplineTotals } from './athlete-profile';

const EMPTY_TOTALS: DisciplineTotals = {
  problems: 0,
  tops: 0,
  zones: 0,
  flashes: 0,
  maxHeight: null,
  attemptsPerTop: null,
};

// Igual que athlete-profile.test.ts: se prueba la aritmética pura
// (deriveShareCard), no el viaje a la base (buildShareCard).

function result(overrides: Partial<AthleteEventResult> = {}): AthleteEventResult {
  return {
    eventSlug: 'liga-paramo-f2',
    eventName: 'Liga Páramo · Fecha 2',
    eventDate: '2026-08-22',
    discipline: 'boulder',
    categoryName: 'Open Femenina',
    roundType: 'qualification',
    rank: 5,
    tied: false,
    field: 20,
    standing: 0.79,
    problems: [],
    cells: [],
    ...overrides,
  };
}

function profile(events: AthleteEventResult[], trend: AthleteProfile['trend'] = null): AthleteProfile {
  return {
    fullName: 'Valentina Ocampo',
    career: {
      events: events.length,
      since: events.at(-1)?.eventDate ?? null,
      bestRank: null,
      bestRankEvent: null,
      podiums: 0,
      lastPodiumEvent: null,
      boulder: null,
      lead: null,
    },
    best: [],
    trend,
    events,
  };
}

describe('deriveShareCard', () => {
  it('refuses an event the athlete has no scored result in', () => {
    const r = deriveShareCard(profile([result()]), 'otro-evento');
    expect(r.ok).toBe(false);
  });

  it('refuses an unscored appearance (rank null)', () => {
    const r = deriveShareCard(profile([result({ rank: null, standing: null })]), 'liga-paramo-f2');
    expect(r.ok).toBe(false);
  });

  it('is a debut when it is the only event on record', () => {
    const r = deriveShareCard(profile([result()]), 'liga-paramo-f2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.variant).toBe('debut');
      expect(r.card.headline).toBe('Mi primera competencia');
    }
  });

  it('is podium only in a final, never in qualification even at rank 1', () => {
    const quali = deriveShareCard(
      profile([result({ eventSlug: 'e1', roundType: 'qualification', rank: 1 }), result({ eventSlug: 'e0', eventDate: '2026-01-01' })]),
      'e1',
    );
    expect(quali.ok && quali.card.variant).toBe('progress');

    const final = deriveShareCard(
      profile([result({ eventSlug: 'e1', roundType: 'final', rank: 1 }), result({ eventSlug: 'e0', eventDate: '2026-01-01' })]),
      'e1',
    );
    expect(final.ok && final.card.variant).toBe('podium');
    expect(final.ok && final.card.rank).toBe(1);
    expect(final.ok && final.card.headline).toBe('1.º lugar');
  });

  it('is a personal record when this standing ties or beats every prior one in the same discipline', () => {
    const events = [
      result({ eventSlug: 'e2', eventDate: '2026-06-01', standing: 0.9 }),
      result({ eventSlug: 'e1', eventDate: '2026-01-01', standing: 0.6 }),
    ];
    const r = deriveShareCard(profile(events), 'e2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.variant).toBe('progress');
      expect(r.card.headline).toBe('Récord personal');
    }
  });

  it('does not call a tie for last place a record, and does not call a lower discipline standing a record either', () => {
    const events = [
      result({ eventSlug: 'e2', eventDate: '2026-06-01', standing: 0.4 }),
      result({ eventSlug: 'e1', eventDate: '2026-01-01', standing: 0.8 }),
    ];
    const r = deriveShareCard(profile(events), 'e2');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.headline).not.toBe('Récord personal');
  });

  it('reports how many ranks it climbed, only when sharing the latest comparable event, and not when that climb is also a record', () => {
    // Un histórico mejor (0.95) es lo que evita que este ascenso también
    // cuente como récord — si no, "récord" siempre le ganaría a "subí N".
    const historicalBest = result({ eventSlug: 'e0', eventDate: '2025-01-01', standing: 0.95 });
    const latest = result({ eventSlug: 'e2', eventDate: '2026-06-01', rank: 3, standing: 0.85 });
    const previous = result({ eventSlug: 'e1', eventDate: '2026-01-01', rank: 8, standing: 0.5 });
    const trend = { latest, previous, delta: 0.35, latestTotals: EMPTY_TOTALS, previousTotals: EMPTY_TOTALS, comparable: true };
    const r = deriveShareCard(profile([latest, previous, historicalBest], trend), 'e2');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.headline).toBe('Subí 5 puestos');
  });

  it('falls back to a neutral milestone when nothing else applies', () => {
    const events = [
      result({ eventSlug: 'e2', eventDate: '2026-06-01', rank: 10, standing: 0.4 }),
      result({ eventSlug: 'e1', eventDate: '2026-01-01', rank: 4, standing: 0.7 }),
    ];
    const trend = {
      latest: events[0]!,
      previous: events[1]!,
      delta: -0.3,
      latestTotals: EMPTY_TOTALS,
      previousTotals: EMPTY_TOTALS,
      comparable: true,
    };
    const r = deriveShareCard(profile(events, trend), 'e2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.variant).toBe('progress');
      expect(r.card.headline).toBe(`Completé ${events[0]!.eventName}`);
    }
  });
});
