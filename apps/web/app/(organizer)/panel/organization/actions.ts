'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { eq, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const updateOrganizationLogoInputSchema = z.object({
  organizationId: z.string().uuid(),
  logoUrl: z.string().url(),
});

type UpdateOrganizationLogoInput = z.infer<typeof updateOrganizationLogoInputSchema>;
type UpdateOrganizationLogoResult = { ok: true } | { ok: false; error: string };

export async function updateOrganizationLogo(
  input: UpdateOrganizationLogoInput,
): Promise<UpdateOrganizationLogoResult> {
  const parsed = updateOrganizationLogoInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos.' };
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' };
  }

  const db = getDb();
  const [org] = await db
    .select({ id: organizations.id, ownerId: organizations.ownerId })
    .from(organizations)
    .where(eq(organizations.id, parsed.data.organizationId));
  if (!org || org.ownerId !== session.user.id) {
    return { ok: false, error: 'Esa organización no existe o no te pertenece.' };
  }

  await db
    .update(organizations)
    .set({ logo: parsed.data.logoUrl })
    .where(eq(organizations.id, org.id));

  return { ok: true };
}
