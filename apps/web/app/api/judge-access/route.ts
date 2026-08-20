import { NextResponse } from 'next/server';
import { z } from 'zod';
import { athletes, categories, eq, events, registrations } from '@crux/db';
import { getDb } from '@/lib/db';
import { clientKey, isRateLimited, recordAttempt } from '@/lib/rate-limit';

const inputSchema = z.object({
  slug: z.string().min(1),
  code: z.string().min(1),
});

export interface JudgeRosterEntry {
  id: string;
  bibNumber: string | null;
  categoryId: string;
  athleteFullName: string;
}

type AccessResult =
  | { ok: true; registrations: JudgeRosterEntry[] }
  | { ok: false; error: string };

// Two jobs: tell a judge immediately that the code is wrong, and hand back the
// competitor list. The list only travels once the code checks out — it is the
// names of everyone registered, so it cannot ride along on the public judge
// page where any passer-by who scans the QR would receive it.
export async function POST(request: Request): Promise<NextResponse<AccessResult>> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
  }

  const db = getDb();
  const [event] = await db
    .select({ id: events.id, judgeCode: events.judgeCode })
    .from(events)
    .where(eq(events.slug, parsed.data.slug));
  if (!event) {
    return NextResponse.json({ ok: false, error: 'Ese evento no existe.' }, { status: 404 });
  }

  const matches =
    event.judgeCode === null ||
    parsed.data.code.trim().toUpperCase() === event.judgeCode.toUpperCase();
  // El freno se consulta **solo en la rama del código malo**. Antes se miraba
  // antes de validar, y en un gimnasio eso deja afuera a los jueces buenos: una
  // wifi es una sola IP pública, así que los tres teléfonos comparten cubeta, y
  // cinco dedazos de uno bloqueaban a los otros dos justo al arrancar el evento.
  // Un código correcto ya nunca toca el limitador; el ataque sigue frenado,
  // porque un código malo jamás llega hasta acá.
  if (!matches) {
    const key = clientKey(request.headers);
    if (isRateLimited(key)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Has superado el límite de intentos. Espera unos minutos y vuelve a intentarlo.',
        },
        { status: 429 },
      );
    }
    recordAttempt(key);
    return NextResponse.json(
      { ok: false, error: 'Ese código no corresponde a este evento.' },
      { status: 403 },
    );
  }

  const roster = await db
    .select({
      id: registrations.id,
      bibNumber: registrations.bibNumber,
      categoryId: registrations.categoryId,
      athleteFullName: athletes.fullName,
    })
    .from(registrations)
    .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
    .innerJoin(categories, eq(registrations.categoryId, categories.id))
    .where(eq(registrations.eventId, event.id));

  return NextResponse.json({ ok: true, registrations: roster });
}
