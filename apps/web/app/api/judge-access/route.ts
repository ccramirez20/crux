import { NextResponse } from 'next/server';
import { z } from 'zod';
import { athletes, categories, eq, events, registrations } from '@crux/db';
import { getDb } from '@/lib/db';
import { clientKey, isRateLimited, recordFailure } from '@/lib/rate-limit';

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

  const key = clientKey(request);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados códigos incorrectos. Espera unos minutos.' },
      { status: 429 },
    );
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
  if (!matches) {
    recordFailure(key);
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
