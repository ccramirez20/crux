import { athletes, events, eq, organizations } from '@crux/db';
import { isMinor } from '@crux/core';
import { getDb } from './db';
import { loadAthleteProfile, type AthleteEventResult, type AthleteProfile } from './athlete-profile';
import { DISCIPLINE_LABEL, formatEventDate, labelFor, ordinal } from './labels';

// La tarjeta compartible de un resultado. Se deriva entera de datos que ya
// existen — el perfil del atleta, que ya pasó por getLeaderboard/scoreRound —
// nada se recalcula ni se guarda aparte.

export type ShareCardVariant = 'podium' | 'progress' | 'debut';

export interface ShareCard {
  variant: ShareCardVariant;
  headline: string;
  athleteName: string;
  eventName: string;
  eventDateLabel: string | null;
  categoryName: string;
  disciplineLabel: string;
  /** Solo en 'podium'. */
  rank?: 1 | 2 | 3;
  /** null si el organizador no subió logo — la tarjeta sale sin esa fila. */
  organizationName: string | null;
  organizationLogo: string | null;
}

export type ShareCardResult = { ok: true; card: ShareCard } | { ok: false };

function headlineFor(
  result: AthleteEventResult,
  isDebut: boolean,
  isRecord: boolean,
  rankDelta: number | null,
): { variant: ShareCardVariant; headline: string } {
  if (isDebut) {
    return { variant: 'debut', headline: 'Mi primera competencia' };
  }
  if (isRecord) {
    return { variant: 'progress', headline: 'Récord personal' };
  }
  if (rankDelta !== null && rankDelta > 0) {
    return { variant: 'progress', headline: `Subí ${rankDelta} puesto${rankDelta === 1 ? '' : 's'}` };
  }
  return { variant: 'progress', headline: `Completé ${result.eventName}` };
}

/**
 * La parte que decide qué tarjeta sale, sin tocar la base — el mismo reparto
 * que `buildAthleteProfile`/`loadAthleteProfile`: aquí lo que se puede probar
 * con datos de mentira, allá el viaje a la base.
 */
export function deriveShareCard(
  profile: AthleteProfile,
  eventSlug: string,
  org: { name: string | null; logo: string | null } = { name: null, logo: null },
): ShareCardResult {
  const result = profile.events.find((e) => e.eventSlug === eventSlug);
  if (!result || result.rank === null) {
    return { ok: false };
  }

  const disciplineLabel = labelFor(DISCIPLINE_LABEL, result.discipline);
  const base = {
    athleteName: profile.fullName,
    eventName: result.eventName,
    eventDateLabel: formatEventDate(result.eventDate),
    categoryName: result.categoryName,
    disciplineLabel,
    organizationName: org.name,
    organizationLogo: org.logo,
  };

  // Podio: solo en la final, la misma regla que ya usan la tabla y la
  // proyección — una clasificatoria sin final creada todavía es una
  // categoría de una sola ronda, y el segundo ahí no ha llegado a ningún
  // podio.
  if (result.roundType === 'final' && result.rank <= 3) {
    return {
      ok: true,
      card: { ...base, variant: 'podium', headline: `${ordinal(result.rank)} lugar`, rank: result.rank as 1 | 2 | 3 },
    };
  }

  // Debut: el único evento en su historial. Compartir uno viejo que en su
  // momento fue el primero pero ya no es el único cae en "progreso" más
  // abajo, no aquí — es una simplificación deliberada, no un caso raro.
  const isDebut = profile.events.length === 1;

  // Récord: su mejor posición relativa de todas, dentro de la misma
  // modalidad — cruzar boulder con dificultad inventaría una mejora que
  // nadie tuvo, el mismo motivo por el que `Trend.comparable` existe.
  const sameDiscipline = profile.events.filter((e) => e.discipline === result.discipline && e.standing !== null);
  const bestStanding = Math.max(...sameDiscipline.map((e) => e.standing!));
  const isRecord = !isDebut && sameDiscipline.length > 1 && result.standing !== null && result.standing >= bestStanding;

  // Cuántos puestos subió: solo tiene sentido contra el evento inmediatamente
  // anterior y de la misma modalidad — la misma comparación que ya hace
  // `Trend`, pero solo se usa si el evento que se comparte es justo el más
  // reciente (compartir uno viejo con la tendencia de hoy mentiría).
  const trend = profile.trend;
  const rankDelta =
    !isDebut && !isRecord && trend && trend.latest.eventSlug === eventSlug && trend.comparable && trend.previous.rank !== null && trend.latest.rank !== null
      ? trend.previous.rank - trend.latest.rank
      : null;

  const { variant, headline } = headlineFor(result, isDebut, isRecord, rankDelta);
  return { ok: true, card: { ...base, variant, headline } };
}

/**
 * Dado el atleta y el evento que quiere compartir, arma la tarjeta o dice que
 * no — sin excepción para menores (`isMinor`, derivado de `birthDate`, nunca
 * guardado). No hay checkbox de consentimiento que lo salte: un atleta no
 * tiene cuenta, así que no hay quién lo firme.
 */
export async function buildShareCard(athleteId: string, eventSlug: string): Promise<ShareCardResult> {
  const db = getDb();
  const [athlete] = await db
    .select({ birthDate: athletes.birthDate })
    .from(athletes)
    .where(eq(athletes.id, athleteId));
  if (!athlete || isMinor(athlete.birthDate)) {
    return { ok: false };
  }

  const profile = await loadAthleteProfile(athleteId);
  if (!profile) {
    return { ok: false };
  }

  const [org] = await db
    .select({ name: organizations.name, logo: organizations.logo })
    .from(events)
    .innerJoin(organizations, eq(organizations.id, events.organizationId))
    .where(eq(events.slug, eventSlug));

  return deriveShareCard(profile, eventSlug, { name: org?.name ?? null, logo: org?.logo ?? null });
}
