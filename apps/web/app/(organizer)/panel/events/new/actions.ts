'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { eq, events, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

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
  slug: z.string().regex(/^[a-z0-9-]+$/),
  timezone: z.string().min(1),
});

type CreateEventInput = z.infer<typeof createEventInputSchema>;

type CreateEventResult = { ok: true } | { ok: false; error: string };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export async function createEvent(input: CreateEventInput): Promise<CreateEventResult> {
  const parsed = createEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos del evento inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const db = getDb();
  const { organization, ...eventInput } = parsed.data;

  let organizationId: string;
  if (organization.mode === 'existing') {
    const [org] = await db
      .select({ id: organizations.id, ownerId: organizations.ownerId })
      .from(organizations)
      .where(eq(organizations.id, organization.organizationId));
    if (!org || org.ownerId !== session.user.id) {
      return { ok: false, error: 'Esa organización no existe o no te pertenece.' };
    }
    organizationId = org.id;
  } else {
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
      organizationId,
      ownerId: session.user.id,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'Ese slug ya está en uso, elige otro.' };
    }
    throw error;
  }

  redirect('/panel');
}
