import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { SCORING_FORMATS, type Attempt, type ScoringFormat } from '@crux/core';
import { resolveCurrentAttempts, scoreRound, type RankedResult } from '@crux/scoring';
import {
  athletes,
  attempts,
  categories,
  eq,
  events,
  organizations,
  problems,
  registrations,
  rounds,
} from '@crux/db';
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
  timezone: string;
}

export interface TreeRow {
  categoryId: string;
  categoryName: string;
  roundId: string | null;
  roundType: string | null;
  roundOrder: number | null;
  roundAdvances: number | null;
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
  athleteId: string;
  athleteFullName: string;
}

export interface LeaderboardProblem {
  id: string;
  number: number;
  name: string | null;
  /**
   * Cuánto vale el bloque, y `null` en los formatos que no puntúan por bloque.
   * Van en pantalla, no solo en el cálculo: sin el precio a la vista, una tabla
   * de liga muestra un puntaje de 1600 al lado de cinco casillas doradas y no
   * hay forma de llegar de las unas al otro. `zonePoints` en `null` con
   * `topPoints` puesto es el bloque sin crédito parcial, que es justo el que
   * genera el reclamo si no se anuncia.
   */
  topPoints: number | null;
  zonePoints: number | null;
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
  /** Links to the competitor's history. A random UUID — not the document id. */
  athleteId: string | null;
  athleteName: string;
  bibNumber: string | null;
  /** Carries rank, tied, and the format's own columns — the visible tiebreaks. */
  result: RankedResult;
  cells: LeaderboardCell[];
}

/**
 * Standings as they stood once a block closed. The x axis has to be something
 * every competitor shares — attempts are not: a field where one climber was
 * judged twelve times and another four reads as if everybody climbed until
 * attempt 70. Blocks are the common yardstick, so a point is "the round scored
 * over blocks 1..n", and the attempt count rides along as real volume.
 */
export interface TimelinePoint {
  /** The block this point closes. The tick on screen. */
  problemNumber: number;
  /** Attempts judged on blocks 1..n across the category — secondary information. */
  attempts: number;
  ranks: Record<string, number>;
}

/** How hard a block turned out to be, which is only knowable from the wall. */
export interface ProblemStats {
  problemId: string;
  number: number;
  tops: number;
  /** Reached the zone and did not top. Always 0 in lead, where judges record height. */
  zones: number;
  /** Topped on the first go. To a climber this is the honest read on how hard a block was. */
  flashes: number;
  /** Cuántos compiten en esa ronda — el denominador. En una final son los finalistas, no la categoría entera. */
  field: number;
}

export interface LeaderboardRound {
  id: string;
  type: string;
  order: number;
  problems: LeaderboardProblem[];
  rows: LeaderboardRow[];
  /** Set when the round can't be scored; the screen says so instead of showing a wrong table. */
  error: string | null;
  timeline: TimelinePoint[];
  problemStats: ProblemStats[];
}

/**
 * Replays the round block by block: score it over block 1, then blocks 1-2, and
 * so on, and the standings tell their own story — who led early, who overtook
 * whom. Every competitor is measured against the same blocks at every point,
 * which is what makes two lines comparable.
 *
 * Nothing is stored to make this work. Attempts are append-only (decision #1),
 * so the past is still in the table and re-scoring a subset reconstructs it.
 *
 * ponytail: one replay per block per round per cache window, whole-event. Fine
 * for a gym event; if a big one ever drags, move the timeline to its own
 * endpoint and compute it only for the round actually on screen.
 */
function buildTimeline(
  format: ScoringFormat,
  roundAttempts: Attempt[],
  problems: LeaderboardProblem[],
  config: { problemIds: string[]; registrationIds: string[]; problemPoints: RoundPoints },
): TimelinePoint[] {
  if (roundAttempts.length === 0) {
    return [];
  }

  const ordered = [...problems].sort((a, b) => a.number - b.number);
  const points: TimelinePoint[] = [];
  for (let count = 1; count <= ordered.length; count++) {
    const soFar = ordered.slice(0, count);
    const ids = new Set(soFar.map((p) => p.id));
    const prefix = roundAttempts.filter((a) => ids.has(a.problemId));
    // A block nobody has been judged on yet would repeat the previous point.
    // Skipping it keeps the axis honest: a flat segment means a placing was
    // held through a block that was actually climbed.
    if (prefix.length === (points.at(-1)?.attempts ?? 0)) {
      continue;
    }
    const scored = scoreRound(format, prefix, { ...config, problemIds: [...ids] });
    if (!scored.ok) {
      return [];
    }
    points.push({
      problemNumber: soFar.at(-1)!.number,
      attempts: prefix.length,
      ranks: Object.fromEntries(scored.value.map((r) => [r.registrationId, r.rank])),
    });
  }
  return points;
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

type RoundPoints = Record<string, { topPoints: number; zonePoints: number | null }>;

interface RoundDraft {
  id: string;
  type: string;
  order: number;
  advances: number | null;
  problems: LeaderboardProblem[];
  problemPoints: RoundPoints;
}

interface CategoryDraft {
  id: string;
  name: string;
  rounds: RoundDraft[];
}

/**
 * Quiénes pasan de una ronda a la siguiente.
 *
 * `rows` llega ya ordenada por puesto desde packages/scoring.
 *
 * **Un empate en el corte pasa completo.** Si clasifican 8 y los puestos 7, 8 y
 * 9 empataron, pasan los nueve: partir un empate por el orden en que quedaron
 * en un arreglo es inventar un desempate que el formato no tiene, y en una
 * competencia federada eso es una reclamación. Quien quiera cortar exacto
 * desempata en la pared, no en la tabla.
 */
export function advancingIds(rows: LeaderboardRow[], advances: number | null): string[] {
  if (advances === null || advances >= rows.length) {
    return rows.map((r) => r.registrationId);
  }
  if (advances <= 0) {
    return [];
  }
  const cutoff = rows[advances - 1]!.result.rank;
  return rows.filter((r) => r.result.rank <= cutoff).map((r) => r.registrationId);
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
        advances: row.roundAdvances,
        problems: [],
        problemPoints: {},
      };
      category.rounds.push(round);
    }
    if (row.problemId === null || row.problemNumber === null) {
      continue;
    }
    round.problems.push({
      id: row.problemId,
      number: row.problemNumber,
      name: row.problemName,
      topPoints: row.problemTopPoints,
      zonePoints: row.problemZonePoints,
    });
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

    // Las rondas se recorren en orden y no con `map` porque cada una depende de
    // la anterior: el campo de la semifinal son quienes pasaron la
    // clasificatoria, y el de la final quienes pasaron la semifinal.
    const rounds: LeaderboardRound[] = [];
    let field = categoryRegistrations;

    for (const round of [...category.rounds].sort((a, b) => a.order - b.order)) {
      const built = buildRound(round, field);
      rounds.push(built);
      // Una ronda sin filas no recorta nada: o todavía no tiene bloques, o el
      // formato falló. Vaciar el campo ahí dejaría las rondas siguientes en
      // blanco por un evento a medio armar.
      if (built.rows.length > 0) {
        const passing = new Set(advancingIds(built.rows, round.advances));
        field = field.filter((r) => passing.has(r.id));
      }
    }

    function buildRound(round: RoundDraft, roundField: RegistrationRow[]): LeaderboardRound {
      const base = {
        id: round.id,
        type: round.type,
        order: round.order,
        problems: round.problems,
        timeline: [],
        problemStats: [],
      };

      if (!format.success) {
        return { ...base, rows: [], error: `Formato de puntaje desconocido: ${event.scoringFormat}` };
      }
      // Scoring an empty round would tie every competitor at first place, which
      // reads as a result rather than as an event still being set up.
      if (round.problems.length === 0) {
        return { ...base, rows: [], error: null };
      }

      const problemIds = round.problems.map((p) => p.id);
      // Una ronda solo sabe de la gente que está en ella. Sin esto, un intento
      // de alguien que no clasificó —capturado por error, o por un juez en el
      // bloque equivocado— entra igual en el conteo del muro y en la línea de
      // tiempo: la ronda llegaba a decir "18 tops de 16 posibles", que es
      // imposible y se ve en pantalla. El puntaje ya estaba a salvo porque
      // `scoreRound` recibe la lista de inscripciones; lo que faltaba era
      // recortar todo lo demás con el mismo criterio.
      const inField = new Set(roundField.map((r) => r.id));
      const fieldAttempts = attemptRows.filter((a) => inField.has(a.registrationId));
      const config = {
        problemIds,
        // Everyone registered in the category, not just whoever has been
        // judged: that is what puts a competitor with no attempts on screen
        // at zero and last instead of leaving them off the table.
        registrationIds: roundField.map((r) => r.id),
        problemPoints: round.problemPoints,
      };
      const scored = scoreRound(format.data, fieldAttempts, config);
      if (!scored.ok) {
        return { ...base, rows: [], error: scored.error.message };
      }

      const current = resolveCurrentAttempts(fieldAttempts, new Set(problemIds));
      const rows = scored.value.map((result) => {
        const registration = roundField.find((r) => r.id === result.registrationId);
        return {
          registrationId: result.registrationId,
          athleteId: registration?.athleteId ?? null,
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

      // How hard each block actually turned out to be. Not the setter's guess —
      // what the field did with it.
      const problemStats: ProblemStats[] = round.problems.map((problem) => {
        const onProblem = current.filter((a) => a.problemId === problem.id);
        return {
          problemId: problem.id,
          number: problem.number,
          tops: onProblem.filter((a) => a.top).length,
          zones: onProblem.filter((a) => a.zone && !a.top).length,
          flashes: onProblem.filter((a) => a.top && (a.topAttempts ?? 1) === 1).length,
          field: roundField.length,
        };
      });

      const roundAttempts = fieldAttempts.filter((a) => problemIds.includes(a.problemId));

      return {
        ...base,
        rows,
        error: null,
        timeline: buildTimeline(format.data, roundAttempts, round.problems, config),
        problemStats,
      };
    }

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
      timezone: events.timezone,
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
        roundAdvances: rounds.advances,
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
    // Name, bib, and the athlete's UUID — the last one only so a row can link
    // to that competitor's history. This page is public and stays projected on
    // a wall: document id and birth date have no business leaving the database.
    db
      .select({
        id: registrations.id,
        bibNumber: registrations.bibNumber,
        categoryId: registrations.categoryId,
        athleteId: athletes.id,
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
      timezone: event.timezone,
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

export interface SiblingEvent {
  slug: string;
  name: string;
  date: string | null;
}

export interface SiblingEvents {
  /** Cómo se llama quien las organiza: es lo único que de verdad las agrupa. */
  organization: string;
  events: SiblingEvent[];
}

/**
 * Las otras competencias de la misma organización.
 *
 * Una fecha de liga suelta se lee como un evento suelto: quien llega a la
 * Fecha 2 por un enlace de WhatsApp no tiene forma de saber que existe una
 * Fecha 1, ni que la liga es una liga.
 *
 * Va aparte de `getLeaderboard` y no dentro del payload a propósito: eso viaja
 * a cada espectador cada cinco segundos, y esta lista no cambia durante un
 * evento. Aquí la caché es de un minuto porque lo único que la mueve es que el
 * organizador cree otra fecha.
 */
async function loadSiblingEvents(slug: string): Promise<SiblingEvents> {
  const db = getDb();
  const [event] = await db
    .select({
      id: events.id,
      organizationId: events.organizationId,
      organization: organizations.name,
    })
    .from(events)
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(eq(events.slug, slug));
  if (!event) {
    return { organization: '', events: [] };
  }

  const rows = await db
    .select({ slug: events.slug, name: events.name, date: events.date })
    .from(events)
    .where(eq(events.organizationId, event.organizationId))
    .orderBy(events.date);

  return { organization: event.organization, events: rows.filter((row) => row.slug !== slug) };
}

export const getSiblingEvents = unstable_cache(loadSiblingEvents, ['sibling-events'], {
  revalidate: 60,
});
