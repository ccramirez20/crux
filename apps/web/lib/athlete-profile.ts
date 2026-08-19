import { athletes, categories, eq, events, registrations } from '@crux/db';
import { getDb } from './db';
import {
  getLeaderboard,
  type LeaderboardCell,
  type LeaderboardPayload,
  type LeaderboardProblem,
} from './leaderboard';

// La historia de un competidor entre eventos. Lo que la tabla de un evento no
// puede decir: cuánto lleva escalado, cuáles fueron sus mejores resultados y
// si viene mejorando.
//
// Nada de puntaje se recalcula aquí. Cada evento se pide a getLeaderboard, que
// ya pasó por scoreRound y ya está cacheado; este archivo solo lee la fila del
// atleta y suma. Por eso es corto: las reglas viven en packages/scoring.

export interface ProfileRegistrationRow {
  registrationId: string;
  categoryId: string;
  eventSlug: string;
  eventName: string;
  eventDate: string | null;
  discipline: string;
}

export interface AthleteEventResult {
  eventSlug: string;
  eventName: string;
  eventDate: string | null;
  discipline: string;
  categoryName: string;
  roundType: string | null;
  /** null cuando la ronda no se pudo puntuar o el atleta no aparece en ella. */
  rank: number | null;
  tied: boolean;
  /** Cuántos compitieron en esa categoría. El puesto no significa nada sin esto. */
  field: number;
  /**
   * Posición relativa al campo: 1 = ganó, 0 = último. Es la única cifra de
   * resultado comparable entre eventos — un 8.º de 26 vale más que un 3.º de 5,
   * y el puesto pelado no lo dice. null cuando no hay con quién compararse.
   */
  standing: number | null;
  problems: LeaderboardProblem[];
  cells: LeaderboardCell[];
}

// Una sola forma para las dos modalidades, y la pantalla escoge qué cifras
// dibuja: en boulder se leen tops/zonas/flashes, en dificultad se leen
// completadas (`tops`) y altura máxima. Dos interfaces casi iguales serían más
// código para decir lo mismo.
export interface DisciplineTotals {
  /** Unidades con registro de juez. Un bloque que nadie juzgó no se intentó. */
  problems: number;
  tops: number;
  /** Incluye los tops: un top pasa por la zona en el camino, igual que en la tabla. */
  zones: number;
  flashes: number;
  /** Solo dificultad. null cuando ningún juez anotó altura. */
  maxHeight: number | null;
  /**
   * Intentos promedio por cada top logrado. Aquí **menos es mejor**, al revés
   * que todas las demás cifras de esta interfaz — quien lo pinte tiene que
   * invertir el sentido de la flecha. Solo cuenta los bloques que sí topó: los
   * que no topó no tienen un "intentos hasta el top" que promediar. null sin
   * tops, porque dividir por cero no es "cero intentos".
   */
  attemptsPerTop: number | null;
}

interface CareerTotals {
  events: number;
  /** Fecha del evento más antiguo: desde cuándo compite. */
  since: string | null;
  bestRank: number | null;
  /** Dónde consiguió ese mejor puesto. */
  bestRankEvent: string | null;
  podiums: number;
  /** El podio más reciente, no el primero: con varios, el último es la noticia. */
  lastPodiumEvent: string | null;
  boulder: DisciplineTotals | null;
  lead: DisciplineTotals | null;
}

export interface Trend {
  latest: AthleteEventResult;
  previous: AthleteEventResult;
  /** Diferencia de posición relativa. Negativo = le fue peor que la vez pasada. */
  delta: number;
  /** Totales de cada uno por separado, para comparar qué cambió por debajo del puesto. */
  latestTotals: DisciplineTotals;
  previousTotals: DisciplineTotals;
  /**
   * false cuando las dos competencias son de modalidades distintas: los tops de
   * un boulder y las rutas completadas de una de dificultad no se comparan, y
   * ponerlos lado a lado inventaría una mejora que nadie tuvo.
   */
  comparable: boolean;
}

export interface AthleteProfile {
  fullName: string;
  career: CareerTotals;
  /** Hasta tres, por posición relativa — nunca por puesto crudo. */
  best: AthleteEventResult[];
  /** null con menos de dos eventos comparables. */
  trend: Trend | null;
  /** Más nuevo primero. */
  events: AthleteEventResult[];
}

function resultFor(
  row: ProfileRegistrationRow,
  payload: LeaderboardPayload,
): AthleteEventResult | null {
  const category = payload.categories.find((c) => c.id === row.categoryId);
  if (!category) {
    return null;
  }

  // El puesto que cuenta es el de la ronda más avanzada en la que apareció: si
  // llegó a la final, la clasificatoria ya no lo describe. Si no aparece en
  // ninguna —ronda vacía, o formato que no se pudo puntuar— igual se muestra el
  // evento, sin puesto, en vez de esconder que compitió.
  const byOrder = [...category.rounds].sort((a, b) => b.order - a.order);
  const round = byOrder.find((r) => r.rows.some((x) => x.registrationId === row.registrationId)) ?? byOrder[0];
  const scored = round?.rows.find((x) => x.registrationId === row.registrationId);

  const field = round?.rows.length ?? 0;
  const rank = scored?.result.rank ?? null;

  return {
    eventSlug: row.eventSlug,
    eventName: row.eventName,
    eventDate: row.eventDate,
    discipline: row.discipline,
    categoryName: category.name,
    roundType: round?.type ?? null,
    rank,
    tied: scored?.result.tied ?? false,
    field,
    // field <= 1 no es un resultado: nadie contra quien medirse, y la división
    // sería por cero.
    standing: rank !== null && field > 1 ? (field - rank) / (field - 1) : null,
    problems: round?.problems ?? [],
    cells: scored?.cells ?? [],
  };
}

function totalsFor(results: AthleteEventResult[]): DisciplineTotals | null {
  if (results.length === 0) {
    return null;
  }
  const cells = results.flatMap((r) => r.cells);
  const heights = cells.map((c) => c.height).filter((h): h is number => h !== null);
  const topped = cells.filter((c) => c.top);
  // Un top sin número de intentos se cuenta como uno: es lo mismo que asume
  // `flashes` una línea más abajo, y contarlo como cero abarataría el promedio.
  const attempts = topped.reduce((sum, c) => sum + (c.topAttempts ?? 1), 0);
  return {
    problems: cells.length,
    tops: topped.length,
    zones: cells.filter((c) => c.zone).length,
    flashes: cells.filter((c) => c.top && (c.topAttempts ?? 1) === 1).length,
    maxHeight: heights.length > 0 ? Math.max(...heights) : null,
    attemptsPerTop: topped.length > 0 ? attempts / topped.length : null,
  };
}

/** Más reciente primero; un evento sin fecha va al final y no adelante de todos. */
function byDateDesc(a: AthleteEventResult, b: AthleteEventResult): number {
  if (a.eventDate === b.eventDate) return 0;
  if (a.eventDate === null) return 1;
  if (b.eventDate === null) return -1;
  return b.eventDate.localeCompare(a.eventDate);
}

export function buildAthleteProfile(
  fullName: string,
  rows: ProfileRegistrationRow[],
  leaderboards: Map<string, LeaderboardPayload>,
): AthleteProfile {
  const results: AthleteEventResult[] = [];
  for (const row of rows) {
    const payload = leaderboards.get(row.eventSlug);
    if (!payload) {
      continue;
    }
    const result = resultFor(row, payload);
    if (result) {
      results.push(result);
    }
  }

  const events = [...results].sort(byDateDesc);
  const ranked = results.filter((r) => r.rank !== null);
  // Cronológico: el orden en que se vivieron, que es el de la chispa y el que
  // decide cuál es "el anterior".
  const standings = results.filter((r) => r.standing !== null).sort((a, b) => byDateDesc(b, a));

  const best = [...standings]
    // Por posición relativa, jamás por rank: ordenar por puesto crudo pondría
    // un 3.º de 5 encima de un 8.º de 26. Empate, gana el campo más grande —
    // el mismo porcentaje contra más gente es mejor resultado.
    .sort((a, b) => b.standing! - a.standing! || b.field - a.field)
    .slice(0, 3);

  const latest = standings.at(-1);
  const previous = standings.at(-2);

  const bestRank = ranked.length > 0 ? Math.min(...ranked.map((r) => r.rank!)) : null;
  // `events` ya viene de más reciente a más antiguo, así que el primer podio de
  // esa lista es el último que consiguió y el último evento es el más viejo.
  const podiums = ranked.filter((r) => r.rank! <= 3);
  const lastPodium = events.find((r) => r.rank !== null && r.rank <= 3);

  return {
    fullName,
    career: {
      events: results.length,
      since: events.at(-1)?.eventDate ?? null,
      bestRank,
      bestRankEvent: bestRank === null ? null : (ranked.find((r) => r.rank === bestRank)?.eventName ?? null),
      podiums: podiums.length,
      lastPodiumEvent: lastPodium?.eventName ?? null,
      boulder: totalsFor(results.filter((r) => r.discipline === 'boulder')),
      lead: totalsFor(results.filter((r) => r.discipline !== 'boulder')),
    },
    best,
    trend:
      latest && previous
        ? {
            latest,
            previous,
            delta: latest.standing! - previous.standing!,
            latestTotals: totalsFor([latest])!,
            previousTotals: totalsFor([previous])!,
            comparable: latest.discipline === previous.discipline,
          }
        : null,
    events,
  };
}

export async function loadAthleteProfile(athleteId: string): Promise<AthleteProfile | null> {
  const db = getDb();

  // Una sola consulta para todo lo que no es puntaje. El nombre viene repetido
  // por fila, que es más barato que un segundo viaje.
  const rows = await db
    .select({
      fullName: athletes.fullName,
      registrationId: registrations.id,
      categoryId: registrations.categoryId,
      eventSlug: events.slug,
      eventName: events.name,
      eventDate: events.date,
      discipline: events.discipline,
    })
    .from(registrations)
    .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .innerJoin(categories, eq(registrations.categoryId, categories.id))
    .where(eq(athletes.id, athleteId));

  if (rows.length === 0) {
    // Sin inscripciones no se sabe si el atleta existe o no, y da igual: no hay
    // perfil que mostrar de alguien que nunca compitió.
    return null;
  }

  // ponytail: una lectura de tabla por evento del atleta. Son lecturas
  // cacheadas (unstable_cache, 5s) que comparte con la tabla pública, en una
  // página de tráfico bajo. Si alguien llega a treinta eventos, materializar el
  // puesto final al cerrar el evento.
  const slugs = [...new Set(rows.map((r) => r.eventSlug))];
  const payloads = await Promise.all(slugs.map((slug) => getLeaderboard(slug)));
  const leaderboards = new Map<string, LeaderboardPayload>();
  for (const [index, payload] of payloads.entries()) {
    if (payload) {
      leaderboards.set(slugs[index]!, payload);
    }
  }

  return buildAthleteProfile(rows[0]!.fullName, rows, leaderboards);
}
