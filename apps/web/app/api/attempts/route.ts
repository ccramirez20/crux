import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attempts, categories, eq, events, problems, registrations, rounds, type Db } from '@crux/db';
import { resolveCurrentAttempts } from '@crux/scoring';
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
  judgeCode: z.string().nullable(),
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

// The judge screen has no login — the QR is public and anyone at the gym can
// scan it — so this is the only place the event's code is actually enforced.
// The client checks it too, but only to fail fast; a client check protects
// nobody.
async function judgeCodeAccepted(db: Db, problemId: string, given: string | null): Promise<boolean> {
  const [row] = await db
    .select({ judgeCode: events.judgeCode })
    .from(problems)
    .innerJoin(rounds, eq(problems.roundId, rounds.id))
    .innerJoin(categories, eq(rounds.categoryId, categories.id))
    .innerJoin(events, eq(categories.eventId, events.id))
    .where(eq(problems.id, problemId));
  if (!row || row.judgeCode === null) {
    return true;
  }
  return given !== null && given.trim().toUpperCase() === row.judgeCode.toUpperCase();
}

export interface CurrentAttempt {
  registrationId: string;
  judgeLabel: string;
  top: boolean;
  topAttempts: number | null;
  zone: boolean;
  zoneAttempts: number | null;
  height: number | null;
}

type RosterResult = { ok: true; attempts: CurrentAttempt[] } | { ok: false; error: string };

// Lets a judge see who on the wall has already been scored — including by a
// different judge on a different phone, which is the whole point. Which row
// counts as current is a domain rule, so it comes from @crux/scoring rather
// than being re-derived here in SQL.
export async function GET(request: Request): Promise<NextResponse<RosterResult>> {
  const problemId = new URL(request.url).searchParams.get('problemId');
  if (!problemId || !z.string().uuid().safeParse(problemId).success) {
    return NextResponse.json({ ok: false, error: 'Bloque inválido.' }, { status: 400 });
  }

  const rows = await getDb().select().from(attempts).where(eq(attempts.problemId, problemId));
  const current = resolveCurrentAttempts(rows, new Set([problemId]));

  return NextResponse.json({
    ok: true,
    attempts: current.map((attempt) => ({
      registrationId: attempt.registrationId,
      judgeLabel: attempt.judgeLabel,
      top: attempt.top,
      topAttempts: attempt.topAttempts,
      zone: attempt.zone,
      zoneAttempts: attempt.zoneAttempts,
      height: attempt.height,
    })),
  });
}

export async function POST(request: Request): Promise<NextResponse<SyncResult>> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = attemptInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos de intento inválidos.' }, { status: 400 });
  }

  const input: AttemptInput = parsed.data;
  const db = getDb();

  if (!(await judgeCodeAccepted(db, input.problemId, input.judgeCode))) {
    return NextResponse.json(
      { ok: false, error: 'El código del evento no es correcto.' },
      { status: 403 },
    );
  }

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
