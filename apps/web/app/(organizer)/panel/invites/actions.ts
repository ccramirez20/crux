'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { inviteCodes } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { generateCode } from '@/lib/codes';
import { isAdmin } from '@/lib/admin';
import { deleteUnusedInvite } from '@/lib/invites';

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

/**
 * Descarta una invitación que nadie alcanzó a usar.
 *
 * El `used_at IS NULL` del WHERE no es una comprobación previa sino la
 * condición del borrado: una invitación ya canjeada no se puede borrar ni
 * equivocándose, porque es el rastro de con qué código entró ese organizador.
 * Por eso tampoco hay confirmación — lo único que esto puede borrar es un
 * código que no le sirvió a nadie.
 */
export async function deleteInvite(formData: FormData): Promise<void> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || !isAdmin(session.user.email)) {
    throw new Error('No autorizado');
  }

  const id = formData.get('id');
  if (typeof id !== 'string') {
    throw new Error('Invitación inválida');
  }

  await deleteUnusedInvite(getDb(), id);

  revalidatePath('/panel/invites');
}
