'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { GENDERS, ROUND_TYPES, type RoundType } from '@crux/core';
import { and, categories, eq, events, problems, registrations, rounds } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { leagueBlockNeedsPoints } from '@/lib/problem-points';

type ActionResult = { ok: true } | { ok: false; error: string };

const ROUND_ORDER: Record<RoundType, number> = {
  qualification: 1,
  semifinal: 2,
  final: 3,
};

const createCategoryInputSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  gender: z.enum(GENDERS).optional(),
  minAge: z.number().int().positive().optional(),
  maxAge: z.number().int().positive().optional(),
  level: z.string().min(1).optional(),
});
type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export async function createCategory(input: CreateCategoryInput): Promise<ActionResult> {
  const parsed = createCategoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de la categoría inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const db = getDb();
  const { eventId, ...categoryInput } = parsed.data;

  const [event] = await db
    .select({ id: events.id, ownerId: events.ownerId })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event || event.ownerId !== session.user.id) {
    return { ok: false, error: 'Ese evento no existe o no te pertenece.' };
  }

  await db.insert(categories).values({ ...categoryInput, eventId });
  revalidatePath(`/panel/events/${eventId}`);
  return { ok: true };
}

const createRoundInputSchema = z.object({
  eventId: z.string().uuid(),
  categoryId: z.string().uuid(),
  type: z.enum(ROUND_TYPES),
});
type CreateRoundInput = z.infer<typeof createRoundInputSchema>;

export async function createRound(input: CreateRoundInput): Promise<ActionResult> {
  const parsed = createRoundInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de la ronda inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const db = getDb();
  const { eventId, categoryId, type } = parsed.data;

  const [row] = await db
    .select({ ownerId: events.ownerId })
    .from(categories)
    .innerJoin(events, eq(categories.eventId, events.id))
    .where(eq(categories.id, categoryId));
  if (!row || row.ownerId !== session.user.id) {
    return { ok: false, error: 'Esa categoría no existe o no te pertenece.' };
  }

  await db.insert(rounds).values({ categoryId, type, order: ROUND_ORDER[type] });
  revalidatePath(`/panel/events/${eventId}`);
  return { ok: true };
}

const createProblemInputSchema = z.object({
  eventId: z.string().uuid(),
  roundId: z.string().uuid(),
  number: z.number().int().positive(),
  name: z.string().min(1).optional(),
  topPoints: z.number().int().nonnegative().optional(),
  zonePoints: z.number().int().nonnegative().optional(),
});
type CreateProblemInput = z.infer<typeof createProblemInputSchema>;

export async function createProblem(input: CreateProblemInput): Promise<ActionResult> {
  const parsed = createProblemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos del bloque inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const db = getDb();
  const { eventId, roundId, ...problemInput } = parsed.data;

  const [row] = await db
    .select({ ownerId: events.ownerId, scoringFormat: events.scoringFormat })
    .from(rounds)
    .innerJoin(categories, eq(rounds.categoryId, categories.id))
    .innerJoin(events, eq(categories.eventId, events.id))
    .where(eq(rounds.id, roundId));
  if (!row || row.ownerId !== session.user.id) {
    return { ok: false, error: 'Esa ronda no existe o no te pertenece.' };
  }
  if (leagueBlockNeedsPoints(row.scoringFormat, problemInput.topPoints)) {
    return { ok: false, error: 'Este evento puntúa por bloque: falta cuántos puntos vale su top.' };
  }

  await db.insert(problems).values({ ...problemInput, roundId });
  revalidatePath(`/panel/events/${eventId}`);
  return { ok: true };
}

// Lo editable del evento y nada más. Fuera quedan tres campos a propósito:
//
// - `slug`: va dentro de cada QR ya impreso y dentro del enlace de inscripción
//   ya compartido. Cambiarlo rompe las dos cosas sin avisar a nadie.
// - `discipline` y `scoringFormat`: reinterpretan intentos ya capturados. El
//   puntaje es derivado, así que cambiar el formato no corrige un dato, cambia
//   el resultado de una competencia que ya ocurrió. Si de verdad se escogió
//   mal, se borra el evento y se vuelve a crear antes de capturar nada.
//
// `judgeCode` sí entra, y es la razón de que esta acción exista: hasta ahora un
// código filtrado no se podía rotar sin tocar la base a mano.
const updateEventInputSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  judgeCode: z.string().min(4).max(32),
  timezone: z.string().min(1),
  // `null` es "el evento no tiene fecha", que es un estado que ya existe en el
  // esquema; `undefined` sería "no lo toques" y aquí siempre se manda entero.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});
type UpdateEventInput = z.infer<typeof updateEventInputSchema>;

export async function updateEvent(input: UpdateEventInput): Promise<ActionResult> {
  const parsed = updateEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos del evento inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const { eventId, ...eventInput } = parsed.data;
  const db = getDb();
  const [owned] = await db
    .select({ ownerId: events.ownerId })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, session.user.id)));
  if (!owned) {
    return { ok: false, error: 'Ese evento no existe o no te pertenece.' };
  }

  await db
    .update(events)
    .set({ ...eventInput, judgeCode: eventInput.judgeCode.toUpperCase() })
    .where(eq(events.id, eventId));
  revalidatePath(`/panel/events/${eventId}`);
  return { ok: true };
}

const updateProblemInputSchema = z.object({
  eventId: z.string().uuid(),
  problemId: z.string().uuid(),
  number: z.number().int().positive(),
  name: z.string().min(1).nullable(),
  topPoints: z.number().int().nonnegative().nullable(),
  zonePoints: z.number().int().nonnegative().nullable(),
});
type UpdateProblemInput = z.infer<typeof updateProblemInputSchema>;

// Editar los puntos de un bloque **no** reescribe ningún puntaje: los intentos
// no se tocan y la tabla se recalcula sola en la siguiente lectura. Por eso es
// seguro, y por eso era el arreglo que más falta hacía — un bloque mal valorado
// solo se corregía con SQL.
export async function updateProblem(input: UpdateProblemInput): Promise<ActionResult> {
  const parsed = updateProblemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos del bloque inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const { eventId, problemId, ...problemInput } = parsed.data;
  const db = getDb();
  const [row] = await db
    .select({ ownerId: events.ownerId, scoringFormat: events.scoringFormat })
    .from(problems)
    .innerJoin(rounds, eq(problems.roundId, rounds.id))
    .innerJoin(categories, eq(rounds.categoryId, categories.id))
    .innerJoin(events, eq(categories.eventId, events.id))
    .where(eq(problems.id, problemId));
  if (!row || row.ownerId !== session.user.id) {
    return { ok: false, error: 'Ese bloque no existe o no te pertenece.' };
  }
  // Mismo borde que al crear: un bloque de liga sin puntos vale cero para todos
  // y deja la tabla entera empatada sin un solo error en pantalla.
  if (leagueBlockNeedsPoints(row.scoringFormat, problemInput.topPoints ?? undefined)) {
    return { ok: false, error: 'Este evento puntúa por bloque: falta cuántos puntos vale su top.' };
  }

  await db.update(problems).set(problemInput).where(eq(problems.id, problemId));
  revalidatePath(`/panel/events/${eventId}`);
  return { ok: true };
}

const setBibInputSchema = z.object({
  eventId: z.string().uuid(),
  registrationId: z.string().uuid(),
  // Texto y no número: hay ligas que usan "A-12" y hay gimnasios que reparten
  // dorsales con letra de categoría. Vacío borra el dorsal.
  bibNumber: z.string().trim().max(12),
});
type SetBibInput = z.infer<typeof setBibInputSchema>;

export async function setBibNumber(input: SetBibInput): Promise<ActionResult> {
  const parsed = setBibInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Dorsal inválido.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const { eventId, registrationId, bibNumber } = parsed.data;
  const db = getDb();
  const [row] = await db
    .select({ ownerId: events.ownerId })
    .from(registrations)
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(and(eq(registrations.id, registrationId), eq(registrations.eventId, eventId)));
  if (!row || row.ownerId !== session.user.id) {
    return { ok: false, error: 'Esa inscripción no existe o no te pertenece.' };
  }

  await db
    .update(registrations)
    .set({ bibNumber: bibNumber === '' ? null : bibNumber })
    .where(eq(registrations.id, registrationId));
  revalidatePath(`/panel/events/${eventId}`);
  return { ok: true };
}

const numberCategoryInputSchema = z.object({
  eventId: z.string().uuid(),
  categoryId: z.string().uuid(),
  start: z.number().int().nonnegative().max(9999),
});
type NumberCategoryInput = z.infer<typeof numberCategoryInputSchema>;

// Numera en orden de inscripción y **solo los que no tienen dorsal**: el
// gimnasio que ya repartió números impresos los escribe a mano y luego usa esto
// para rellenar el resto sin pisar lo que ya puso.
export async function numberCategory(input: NumberCategoryInput): Promise<ActionResult> {
  const parsed = numberCategoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const { eventId, categoryId, start } = parsed.data;
  const db = getDb();
  const rows = await db
    .select({
      id: registrations.id,
      bibNumber: registrations.bibNumber,
      ownerId: events.ownerId,
    })
    .from(registrations)
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(and(eq(registrations.eventId, eventId), eq(registrations.categoryId, categoryId)))
    .orderBy(registrations.createdAt);
  if (rows.length === 0 || rows[0]!.ownerId !== session.user.id) {
    return { ok: false, error: 'Esa categoría no existe o no te pertenece.' };
  }

  const taken = new Set(rows.map((r) => r.bibNumber).filter((b): b is string => b !== null));
  let next = start;
  for (const row of rows) {
    if (row.bibNumber !== null) {
      continue;
    }
    while (taken.has(String(next))) {
      next += 1;
    }
    taken.add(String(next));
    await db
      .update(registrations)
      .set({ bibNumber: String(next) })
      .where(eq(registrations.id, row.id));
    next += 1;
  }

  revalidatePath(`/panel/events/${eventId}`);
  return { ok: true };
}
