import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { eq, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Solo emite el token de subida — la URL resultante se guarda después con
// `updateOrganizationLogo`, no con `onUploadCompleted`: ese callback lo llama
// Vercel de vuelta al servidor, y en desarrollo local no hay cómo alcanzarlo.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await getAuth().api.getSession({ headers: await headers() });
        if (!session) {
          throw new Error('Sesión inválida, vuelve a iniciar sesión.');
        }

        const organizationId = clientPayload;
        if (!organizationId) {
          throw new Error('Falta la organización.');
        }

        const [org] = await getDb()
          .select({ ownerId: organizations.ownerId })
          .from(organizations)
          .where(eq(organizations.id, organizationId));
        if (!org || org.ownerId !== session.user.id) {
          throw new Error('Esa organización no existe o no te pertenece.');
        }

        return {
          allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
          maximumSizeInBytes: 2 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
