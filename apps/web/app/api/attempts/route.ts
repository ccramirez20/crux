import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attempts, eq, problems, registrations, rounds, type Db } from '@crux/db';
import { getDb } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db-errors';

const attemptInputSchema = z.object({
  clientAttemptId: z.string().uuid(),
  registrationId: z.string().uuid(),
  problemId: z.string().uuid(),
  judgeLabel: z.string().min(1),
  top: z.boolean(),
  topAttempts: z.number().int().positive().nullable(),
  zone: z.boolean(),
  zoneAttempts: z.number().int().positive().nullable(),
  height: z.number().nonnegative().nullable(),
  capturedAt: z.string().datetime(),
});
type AttemptInput = z.infer<typeof attemptInputSchema>;

type SyncResult = { ok: true } | { ok: false; error: string };

// Blocks belong to a round, which belongs to a category — so the athlete's
// registration must be in that same category, not merely the same event.
// This route has no auth (the link is the access control), so it is the
// trust boundary: a cross-category row would be unrankable by every scoring
// strategy, and nothing downstream would catch it.
async function belongToSameCategory(
  db: Db,
  registrationId: string,
  problemId: string,
): Promise<boolean> {
  const [registrationRow] = await db
    .select({ categoryId: registrations.categoryId })
    .from(registrations)
    .where(eq(registrations.id, registrationId));
  if (!registrationRow) {
    return false;
  }

  const [problemRow] = await db
    .select({ categoryId: rounds.categoryId })
    .from(problems)
    .innerJoin(rounds, eq(problems.roundId, rounds.id))
    .where(eq(problems.id, problemId));
  if (!problemRow) {
    return false;
  }

  return registrationRow.categoryId === problemRow.categoryId;
}

export async function POST(request: Request): Promise<NextResponse<SyncResult>> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = attemptInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos de intento inválidos.' }, { status: 400 });
  }

  const input: AttemptInput = parsed.data;
  const db = getDb();

  const inScope = await belongToSameCategory(db, input.registrationId, input.problemId);
  if (!inScope) {
    return NextResponse.json(
      { ok: false, error: 'La inscripción y el bloque no pertenecen a la misma categoría.' },
      { status: 400 },
    );
  }

  try {
    await db.insert(attempts).values({
      clientAttemptId: input.clientAttemptId,
      registrationId: input.registrationId,
      problemId: input.problemId,
      judgeLabel: input.judgeLabel,
      top: input.top,
      topAttempts: input.topAttempts,
      zone: input.zone,
      zoneAttempts: input.zoneAttempts,
      height: input.height,
      capturedAt: new Date(input.capturedAt),
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    // Same clientAttemptId already synced — idempotent re-delivery, not an error.
  }

  return NextResponse.json({ ok: true });
}
