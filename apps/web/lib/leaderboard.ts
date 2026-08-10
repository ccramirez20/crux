import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { SCORING_FORMATS, type Attempt } from '@crux/core';
import { resolveCurrentAttempts, scoreRound, type RankedResult } from '@crux/scoring';
import { athletes, attempts, categories, eq, events, problems, registrations, rounds } from '@crux/db';
import { getDb } from './db';

// `events.scoring_format` is a plain text column, and scoreRound indexes its
// registry with whatever it is handed — an unexpected value would be a
// TypeError, not a bad result. This view is the first code to read that
// column, so the check belongs here.
const scoringFormatSchema = z.enum(SCORING_FORMATS);

export interface LeaderboardEventInfo {
  name: string;
  slug: string;
  discipline: string;
  scoringFormat: string;
  date: string | null;
}

export interface TreeRow {
  categoryId: string;
  categoryName: string;
  roundId: string | null;
  roundType: string | null;
  roundOrder: number | null;
  problemId: string | null;
  problemNumber: number | null;
  problemName: string | null;
  problemTopPoints: number | null;
  problemZonePoints: number | null;
}

export interface RegistrationRow {
  id: string;
  bibNumber: string | null;
  categoryId: string;
  athleteFullName: string;
}

export interface LeaderboardProblem {
  id: string;
  number: number;
  name: string | null;
}

/** What a competitor did on one block — the detail panel, block by block. */
export interface LeaderboardCell {
  problemId: string;
  top: boolean;
  topAttempts: number | null;
  zone: boolean;
  zoneAttempts: number | null;
  height: number | null;
}

export interface LeaderboardRow {
  registrationId: string;
  athleteName: string;
  bibNumber: string | null;
  /** Carries rank, tied, and the format's own columns — the visible tiebreaks. */
  result: RankedResult;
  cells: LeaderboardCell[];
}

export interface LeaderboardRound {
  id: string;
  type: string;
  order: number;
  problems: LeaderboardProblem[];
  rows: LeaderboardRow[];
  /** Set when the round can't be scored; the screen says so instead of showing a wrong table. */
  error: string | null;
}

export interface LeaderboardCategory {
  id: string;
  name: string;
  rounds: LeaderboardRound[];
}

export interface LeaderboardPayload {
  event: LeaderboardEventInfo;
  categories: LeaderboardCategory[];
  updatedAt: string;
}

interface RoundDraft {
  id: string;
  type: string;
  order: number;
  problems: LeaderboardProblem[];
  problemPoints: Record<string, { topPoints: number; zonePoints: number | null }>;
}

interface CategoryDraft {
  id: string;
  name: string;
  rounds: RoundDraft[];
}

/**
 * Pure: rows in, standings out. Every ranking number on the public screen comes
 * from packages/scoring — this only groups the rows, hands each round its
 * config, and keeps the resolved attempts around for the detail panel.
 */
export function buildLeaderboard(
  event: LeaderboardEventInfo,
  treeRows: TreeRow[],
  eventRegistrations: RegistrationRow[],
  attemptRows: Attempt[],
): LeaderboardPayload {
  // Same left-join shape the judge and organizer pages group: a category with
  // no rounds, and a round with no blocks, both come back with null columns
  // and are ordinary states while an organizer is still setting the event up.
  const drafts: CategoryDraft[] = [];
  for (const row of treeRows) {
    let category = drafts.find((c) => c.id === row.categoryId);
    if (!category) {
      category = { id: row.categoryId, name: row.categoryName, rounds: [] };
      drafts.push(category);
    }
    if (row.roundId === null || row.roundType === null || row.roundOrder === null) {
      continue;
    }
    let round = category.rounds.find((r) => r.id === row.roundId);
    if (!round) {
      round = {
        id: row.roundId,
        type: row.roundType,
        order: row.roundOrder,
        problems: [],
        problemPoints: {},
      };
      category.rounds.push(round);
    }
    if (row.problemId === null || row.problemNumber === null) {
      continue;
    }
    round.problems.push({ id: row.problemId, number: row.problemNumber, name: row.problemName });
    // Only league_points events fill these in. A block left without topPoints
    // simply stays out of the map, which scoreLeaguePoints already reads as 0.
    if (row.problemTopPoints !== null) {
      round.problemPoints[row.problemId] = {
        topPoints: row.problemTopPoints,
        zonePoints: row.problemZonePoints,
      };
    }
  }

  const format = scoringFormatSchema.safeParse(event.scoringFormat);

  const categories: LeaderboardCategory[] = drafts.map((category) => {
    const categoryRegistrations = eventRegistrations.filter((r) => r.categoryId === category.id);

    const rounds: LeaderboardRound[] = category.rounds.map((round) => {
      const base = { id: round.id, type: round.type, order: round.order, problems: round.problems };

      if (!format.success) {
        return { ...base, rows: [], error: `Formato de puntaje desconocido: ${event.scoringFormat}` };
      }
      // Scoring an empty round would tie every competitor at first place, which
      // reads as a result rather than as an event still being set up.
      if (round.problems.length === 0) {
        return { ...base, rows: [], error: null };
      }

      const problemIds = round.problems.map((p) => p.id);
      const scored = scoreRound(format.data, attemptRows, {
        problemIds,
        // Everyone registered in the category, not just whoever has been
        // judged: that is what puts a competitor with no attempts on screen
        // at zero and last instead of leaving them off the table.
        registrationIds: categoryRegistrations.map((r) => r.id),
        problemPoints: round.problemPoints,
      });
      if (!scored.ok) {
        return { ...base, rows: [], error: scored.error.message };
      }

      const current = resolveCurrentAttempts(attemptRows, new Set(problemIds));
      const rows = scored.value.map((result) => {
        const registration = categoryRegistrations.find((r) => r.id === result.registrationId);
        return {
          registrationId: result.registrationId,
          athleteName: registration?.athleteFullName ?? 'Sin nombre',
          bibNumber: registration?.bibNumber ?? null,
          result,
          cells: current
            .filter((a) => a.registrationId === result.registrationId)
            .map((a) => ({
              problemId: a.problemId,
              top: a.top,
              topAttempts: a.topAttempts,
              zone: a.zone,
              zoneAttempts: a.zoneAttempts,
              height: a.height,
            })),
        };
      });

      return { ...base, rows, error: null };
    });

    return { id: category.id, name: category.name, rounds };
  });

  return { event, categories, updatedAt: new Date().toISOString() };
}

async function loadLeaderboard(slug: string): Promise<LeaderboardPayload | null> {
  const db = getDb();

  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      discipline: events.discipline,
      scoringFormat: events.scoringFormat,
      date: events.date,
    })
    .from(events)
    .where(eq(events.slug, slug));
  if (!event) {
    return null;
  }

  // Three round trips, not one per category. Each hop costs real latency, and
  // this is the page the whole room opens at once.
  const [treeRows, eventRegistrations, attemptRows] = await Promise.all([
    db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        roundId: rounds.id,
        roundType: rounds.type,
        roundOrder: rounds.order,
        problemId: problems.id,
        problemNumber: problems.number,
        problemName: problems.name,
        problemTopPoints: problems.topPoints,
        problemZonePoints: problems.zonePoints,
      })
      .from(categories)
      .leftJoin(rounds, eq(rounds.categoryId, categories.id))
      .leftJoin(problems, eq(problems.roundId, rounds.id))
      .where(eq(categories.eventId, event.id))
      .orderBy(categories.name, rounds.order, problems.number),
    // Name and bib only. This page is public and stays projected on a wall:
    // document id and birth date have no business leaving the database.
    db
      .select({
        id: registrations.id,
        bibNumber: registrations.bibNumber,
        categoryId: registrations.categoryId,
        athleteFullName: athletes.fullName,
      })
      .from(registrations)
      .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
      .where(eq(registrations.eventId, event.id)),
    db
      .select({
        id: attempts.id,
        sequence: attempts.sequence,
        clientAttemptId: attempts.clientAttemptId,
        registrationId: attempts.registrationId,
        problemId: attempts.problemId,
        judgeLabel: attempts.judgeLabel,
        top: attempts.top,
        topAttempts: attempts.topAttempts,
        zone: attempts.zone,
        zoneAttempts: attempts.zoneAttempts,
        height: attempts.height,
        capturedAt: attempts.capturedAt,
        createdAt: attempts.createdAt,
      })
      .from(attempts)
      .innerJoin(registrations, eq(attempts.registrationId, registrations.id))
      .where(eq(registrations.eventId, event.id)),
  ]);

  return buildLeaderboard(
    {
      name: event.name,
      slug: event.slug,
      discipline: event.discipline,
      scoringFormat: event.scoringFormat,
      date: event.date,
    },
    treeRows,
    eventRegistrations,
    attemptRows,
  );
}

/**
 * Decision #4: everyone in the room opens this at the same time and each of
 * them polls every 5s, so the database must not see one read per viewer. The
 * page and the polling endpoint both come through here and share one result.
 */
export const getLeaderboard = unstable_cache(loadLeaderboard, ['leaderboard'], {
  revalidate: 5,
});
