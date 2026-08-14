'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { inviteCodes } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { generateCode } from '@/lib/codes';
import { isAdmin } from '@/lib/admin';

export async function createInvite(): Promise<void> {
  // El layout de (organizer) protege el renderizado de la página, no esta
  // acción: una server action se invoca directo, sin pasar por el layout. Por
  // eso el chequeo se repite aquí.
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || !isAdmin(session.user.email)) {
    throw new Error('No autorizado');
  }

  await getDb().insert(inviteCodes).values({
    code: generateCode(),
    createdBy: session.user.id,
  });

  revalidatePath('/panel/invites');
}
