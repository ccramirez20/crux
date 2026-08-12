'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { GENDERS, ROUND_TYPES, type RoundType } from '@crux/core';
import { categories, eq, events, problems, rounds } from '@crux/db';
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
