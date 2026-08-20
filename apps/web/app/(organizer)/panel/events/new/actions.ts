'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { eq, events, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db-errors';
import { slugify } from '@/lib/slug';

const createEventInputSchema = z.object({
  organization: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('existing'), organizationId: z.string().uuid() }),
    z.object({
      mode: z.literal('new'),
      name: z.string().min(1),
      location: z.string().min(1),
    }),
  ]),
  name: z.string().min(1),
  discipline: z.enum(['boulder', 'lead']),
  scoringFormat: z.enum([
    'ifsc_boulder',
    'classic_tops_zones',
    'league_points',
    'max_height',
  ]),
  // Sin `slug`: lo calcula el servidor a partir del nombre. El navegador solo
  // enseña una vista previa, y ese texto va impreso en los QR de la pared —
  // no puede venir de lo que mande el cliente.
  judgeCode: z.string().min(4).max(32),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type CreateEventInput = z.infer<typeof createEventInputSchema>;

type CreateEventResult = { ok: true } | { ok: false; error: string };

export async function createEvent(input: CreateEventInput): Promise<CreateEventResult> {
  const parsed = createEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Los datos del evento no son válidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Tu sesión ha expirado. Vuelve a iniciar sesión.' };
  }

  const db = getDb();
  const { organization, ...eventInput } = parsed.data;
  const slug = slugify(eventInput.name);
  if (slug === '') {
    return {
      ok: false,
      error: 'Ese nombre es demasiado corto para crear un enlace. Usa al menos una letra o un número.',
    };
  }

  let organizationId: string;
  if (organization.mode === 'existing') {
    const [org] = await db
      .select({ id: organizations.id, ownerId: organizations.ownerId })
      .from(organizations)
      .where(eq(organizations.id, organization.organizationId));
    if (!org || org.ownerId !== session.user.id) {
      return { ok: false, error: 'Esa organización no existe o no está asociada a tu cuenta.' };
    }
    organizationId = org.id;
  } else {
    // La organización nace con la cuenta. Esta rama queda solo como red: una
    // cuenta creada antes de que el registro la pidiera, o un alta a la que le
    // falló el insert. Sin esta comprobación, cada evento podía estrenar
    // organización y la cuenta terminaba con cinco — que es de donde viene todo
    // esto. Es del servidor a propósito: el formulario ya no ofrece la opción,
    // pero la server action se puede llamar directamente.
    const owned = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ownerId, session.user.id));
    if (owned.length > 0) {
      return {
        ok: false,
        error: 'Ya tienes una organización asociada a tu cuenta.',
      };
    }
    const [org] = await db
      .insert(organizations)
      .values({
        ownerId: session.user.id,
        name: organization.name,
        location: organization.location,
      })
      .returning({ id: organizations.id });
    if (!org) {
      throw new Error('Failed to create organization');
    }
    organizationId = org.id;
  }

  try {
    await db.insert(events).values({
      ...eventInput,
      slug,
      organizationId,
      ownerId: session.user.id,
      // Colombia es el único mercado real hoy — se dejó de pedir en el
      // formulario para no ofrecer una elección que hoy no tiene otra
      // respuesta. `event-form.tsx` (editar) sigue dejando cambiarla a mano
      // para el día en que haga falta.
      timezone: 'America/Bogota',
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Ya no se puede "elegir otro": el enlace sale del nombre. Lo que hay que
      // cambiar es el nombre, y el mensaje lo dice.
      return {
        ok: false,
        error: 'Ya tienes un evento con ese nombre. Usa otro para que el enlace sea diferente.',
      };
    }
    throw error;
  }

  redirect('/panel');
}
