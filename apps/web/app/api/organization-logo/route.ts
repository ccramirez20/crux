import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { eq, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

type Result = { ok: true; url: string } | { ok: false; error: string };

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;

// Sube pasando por nuestro servidor con `put()` en vez de la subida directa
// navegador → Vercel Blob (`@vercel/blob/client` + `handleUpload`). Esa ruta
// directa depende de que vercel.com/api/blob devuelva CORS, y no lo hace para
// este proyecto — comprobado en la consola del navegador (PUT bloqueado,
// "CORS header 'Access-Control-Allow-Origin' missing", 400), y es un problema
// reportado en la comunidad de Vercel, no de este código. Pasar por el
// servidor no tiene el límite de 5 TB del cliente, pero un logo tope 2 MB
// está lejísimos del límite de body de una función de Vercel.
export async function POST(request: Request): Promise<NextResponse<Result>> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Sesión inválida, vuelve a iniciar sesión.' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const organizationId = form.get('organizationId');
  if (!(file instanceof File) || typeof organizationId !== 'string') {
    return NextResponse.json({ ok: false, error: 'Faltan datos en la subida.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: 'El logo debe ser PNG, JPG o WebP.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'El logo no puede pesar más de 2 MB.' }, { status: 400 });
  }

  const db = getDb();
  const [org] = await db
    .select({ id: organizations.id, ownerId: organizations.ownerId })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!org || org.ownerId !== session.user.id) {
    return NextResponse.json({ ok: false, error: 'Esa organización no existe o no te pertenece.' }, { status: 403 });
  }

  try {
    const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true });
    await db.update(organizations).set({ logo: blob.url }).where(eq(organizations.id, org.id));
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (error) {
    // Sin este `catch`, un `put()` que falla (típicamente
    // `BLOB_READ_WRITE_TOKEN` ausente o inválido) tira una excepción sin
    // capturar: Next responde con su página de error genérica en vez de JSON,
    // `response.json()` truena en el cliente, y lo único que ve quien sube el
    // logo es "No se pudo subir el logo" sin ninguna pista de por qué.
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
