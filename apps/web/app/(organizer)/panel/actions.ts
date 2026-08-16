'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ORGANIZATION_COOKIE } from '@/lib/organizations';

// El layout de (organizer) guarda el render de las páginas, no las server
// actions: esta se invoca directo, así que comprueba la sesión ella misma.
export async function selectOrganization(organizationId: string): Promise<void> {
  if (!z.string().uuid().safeParse(organizationId).success) {
    return;
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return;
  }

  // Solo se recuerda una organización que sea suya. `resolveSelectedOrganization`
  // ya ignora una cookie ajena al pintar, pero guardarla sería dejar escrita en
  // el navegador la existencia de una organización de otra persona.
  const [owned] = await getDb()
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.ownerId, session.user.id)));
  if (!owned) {
    return;
  }

  (await cookies()).set(ORGANIZATION_COOKIE, owned.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/panel');
}
