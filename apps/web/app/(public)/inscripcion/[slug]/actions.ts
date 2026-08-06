'use server';

import { z } from 'zod';
import { GENDERS, isEligible, parseDateOnly } from '@crux/core';
import { athletes, categories, eq, registrations } from '@crux/db';
import { getDb } from '@/lib/db';

type ActionResult = { ok: true } | { ok: false; error: string };

const registerInputSchema = z.object({
  eventId: z.string().uuid(),
  categoryId: z.string().uuid(),
  fullName: z.string().min(1),
  documentId: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(GENDERS),
});
type RegisterAthleteInput = z.infer<typeof registerInputSchema>;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export async function registerAthlete(input: RegisterAthleteInput): Promise<ActionResult> {
  const parsed = registerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de inscripción inválidos.' };
  }

  const db = getDb();
  const { eventId, categoryId, fullName, documentId, birthDate, gender } = parsed.data;

  const [category] = await db
    .select({
      id: categories.id,
      eventId: categories.eventId,
      gender: categories.gender,
      minAge: categories.minAge,
      maxAge: categories.maxAge,
    })
    .from(categories)
    .where(eq(categories.id, categoryId));
  if (!category || category.eventId !== eventId) {
    return { ok: false, error: 'Esa categoría no existe para este evento.' };
  }

  if (!isEligible(category, parseDateOnly(birthDate), gender)) {
    return { ok: false, error: 'Esa categoría no corresponde a tu edad o género.' };
  }

  const [existingAthlete] = await db
    .select({ id: athletes.id })
    .from(athletes)
    .where(eq(athletes.documentId, documentId));

  let athleteId: string;
  if (existingAthlete) {
    athleteId = existingAthlete.id;
  } else {
    const [newAthlete] = await db
      .insert(athletes)
      .values({ fullName, documentId, birthDate, gender })
      .returning({ id: athletes.id });
    if (!newAthlete) {
      throw new Error('Failed to create athlete');
    }
    athleteId = newAthlete.id;
  }

  try {
    await db.insert(registrations).values({ athleteId, eventId, categoryId });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'Ya estás inscrito en esta categoría.' };
    }
    throw error;
  }

  return { ok: true };
}
