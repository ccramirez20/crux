import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, events } from '@crux/db';
import { getDb } from '@/lib/db';

const inputSchema = z.object({
  slug: z.string().min(1),
  code: z.string().min(1),
});

type AccessResult = { ok: true } | { ok: false; error: string };

// Only so a judge learns the code is wrong when they type it, instead of
// discovering it after capturing a round's worth of attempts. The real
// enforcement is in POST /api/attempts — this endpoint refusing is not what
// keeps anyone out.
export async function POST(request: Request): Promise<NextResponse<AccessResult>> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
  }

  const [event] = await getDb()
    .select({ judgeCode: events.judgeCode })
    .from(events)
    .where(eq(events.slug, parsed.data.slug));
  if (!event) {
    return NextResponse.json({ ok: false, error: 'Ese evento no existe.' }, { status: 404 });
  }
  if (event.judgeCode === null) {
    return NextResponse.json({ ok: true });
  }

  const matches = parsed.data.code.trim().toUpperCase() === event.judgeCode.toUpperCase();
  return matches
    ? NextResponse.json({ ok: true })
    : NextResponse.json(
        { ok: false, error: 'Ese código no corresponde a este evento.' },
        { status: 403 },
      );
}
