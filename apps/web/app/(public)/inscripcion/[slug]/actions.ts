'use server';

import { z } from 'zod';
import { GENDERS, isEligible, parseDateOnly } from '@crux/core';
import { athletes, categories, eq, events, registrations } from '@crux/db';
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

function hasPostgresUniqueCode(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

// Drizzle wraps the driver error in a query-failure Error whose `.cause` holds
// the real postgres.js PostgresError (where `.code` actually lives) — checking
// only the top-level error lets a duplicate registration crash as a 500 instead
// of returning the friendly message below.
function isUniqueViolation(error: unknown): boolean {
  return (
    hasPostgresUniqueCode(error) ||
    (typeof error === 'object' && error !== null && 'cause' in error && hasPostgresUniqueCode(error.cause))
  );
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
      eventDate: events.date,
    })
    .from(categories)
    .innerJoin(events, eq(categories.eventId, events.id))
    .where(eq(categories.id, categoryId));
  if (!category || category.eventId !== eventId) {
    return { ok: false, error: 'Esa categoría no existe para este evento.' };
  }

  const referenceDate = category.eventDate ? parseDateOnly(category.eventDate) : undefined;
  if (!isEligible(category, parseDateOnly(birthDate), gender, referenceDate)) {
    return { ok: false, error: 'Esa categoría no corresponde a tu edad o género.' };
  }

  async function findExistingAthlete() {
    const [row] = await db
      .select({ id: athletes.id, birthDate: athletes.birthDate, gender: athletes.gender })
      .from(athletes)
      .where(eq(athletes.documentId, documentId));
    return row;
  }

  function athleteMismatch(existing: { birthDate: string | null; gender: string | null }): boolean {
    return existing.birthDate !== birthDate || existing.gender !== gender;
  }

  const existingAthlete = await findExistingAthlete();

  let athleteId: string;
  if (existingAthlete) {
    if (athleteMismatch(existingAthlete)) {
      return {
        ok: false,
        error: 'Ese documento ya está registrado con una fecha de nacimiento o género diferente.',
      };
    }
    athleteId = existingAthlete.id;
  } else {
    try {
      const [newAthlete] = await db
        .insert(athletes)
        .values({ fullName, documentId, birthDate, gender })
        .returning({ id: athletes.id });
      if (!newAthlete) {
        throw new Error('Failed to create athlete');
      }
      athleteId = newAthlete.id;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Two concurrent registrations raced on the same documentId; the other
      // request's insert won, so re-fetch the row it just created.
      const racedAthlete = await findExistingAthlete();
      if (!racedAthlete) {
        throw error;
      }
      if (athleteMismatch(racedAthlete)) {
        return {
          ok: false,
          error: 'Ese documento ya está registrado con una fecha de nacimiento o género diferente.',
        };
      }
      athleteId = racedAthlete.id;
    }
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
