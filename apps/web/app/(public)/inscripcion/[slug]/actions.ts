'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { GENDERS, isEligible, isRegistrationOpen, parseDateOnly } from '@crux/core';
import { and, athletes, categories, eq, events, registrations } from '@crux/db';
import { getDb } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db-errors';
import {
  REGISTRATION_MAX,
  REGISTRATION_WINDOW_MS,
  clientKey,
  isRateLimited,
  recordAttempt,
} from '@/lib/rate-limit';

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

export async function registerAthlete(input: RegisterAthleteInput): Promise<ActionResult> {
  const parsed = registerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de inscripción inválidos.' };
  }

  // El enlace de inscripción es público a propósito: no hay código que fallar,
  // así que lo único limitable es cuántas inscripciones caben por IP. Con
  // prefijo porque el contador es el mismo del código de juez, y una IP puede
  // ser las dos cosas — la wifi del gimnasio, sin ir más lejos.
  const key = `reg:${clientKey(await headers())}`;
  if (isRateLimited(key, REGISTRATION_MAX)) {
    return {
      ok: false,
      error: 'Demasiadas inscripciones desde esta conexión. Espera unos minutos y vuelve a intentar.',
    };
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
      timezone: events.timezone,
      registrationDeadline: events.registrationDeadline,
    })
    .from(categories)
    .innerJoin(events, eq(categories.eventId, events.id))
    .where(eq(categories.id, categoryId));
  if (!category || category.eventId !== eventId) {
    return { ok: false, error: 'Esa categoría no existe para este evento.' };
  }

  // Se vuelve a mirar aquí y no solo al pintar la página: entre que alguien
  // abrió el formulario y le dio a enviar puede haber pasado la medianoche, y
  // la página es pública, así que el envío puede llegar sin haber pasado por
  // ella.
  if (!isRegistrationOpen(category.registrationDeadline, category.timezone)) {
    return { ok: false, error: 'Las inscripciones para este evento ya se cerraron.' };
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
      // Se dice en qué categoría quedó y qué hacer, porque el caso real no es
      // alguien insistiendo: es alguien que dudó, se inscribió en la categoría
      // que no era y vuelve a entrar creyendo que puede corregirlo solo. No
      // puede — no hay cuenta de atleta — así que la salida es avisarle al
      // organizador, que sí tiene cómo moverlo.
      const [previa] = await db
        .select({ categoryName: categories.name })
        .from(registrations)
        .innerJoin(categories, eq(registrations.categoryId, categories.id))
        .where(and(eq(registrations.athleteId, athleteId), eq(registrations.eventId, eventId)));
      const donde = previa ? ` en ${previa.categoryName}` : '';
      return {
        ok: false,
        error: `Ya estás inscrito en este evento${donde}. Si te equivocaste de categoría, pídele el cambio a quien organiza.`,
      };
    }
    throw error;
  }

  // Se cuenta la inscripción que sí quedó creada, no el envío. Un rechazo —
  // categoría que no corresponde, documento repetido— no gasta cupo: quien se
  // equivoca de casilla dos veces seguidas no es a quien hay que frenar.
  recordAttempt(key, REGISTRATION_WINDOW_MS);
  return { ok: true };
}
