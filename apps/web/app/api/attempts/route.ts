import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attempts, categories, eq, events, problems, registrations, rounds, type Db } from '@crux/db';
import { resolveCurrentAttempts } from '@crux/scoring';
import { attemptVerdict } from '@/lib/attempt-scope';
import { getDb } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db-errors';
import { clientKey, isRateLimited, recordFailure } from '@/lib/rate-limit';

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

/**
 * Lo que hace falta saber de la base para decidir si una captura entra: el
 * bloque con su categoría y el código de su evento, y la categoría de la
 * inscripción. Son dos lecturas independientes, así que van juntas — la cola
 * del juez las paga una por intento al ponerse al día tras una caída de wifi,
 * y con la base en la nube cada ida y vuelta es latencia real.
 *
 * La decisión que sale de esto vive en `attemptVerdict`, que es puro y está
 * probado; aquí solo se traen las filas.
 */
async function loadScope(db: Db, registrationId: string, problemId: string) {
  const [problemRows, registrationRows] = await Promise.all([
    db
      .select({ categoryId: rounds.categoryId, judgeCode: events.judgeCode })
      .from(problems)
      .innerJoin(rounds, eq(problems.roundId, rounds.id))
      .innerJoin(categories, eq(rounds.categoryId, categories.id))
      .innerJoin(events, eq(categories.eventId, events.id))
      .where(eq(problems.id, problemId)),
    db
      .select({ categoryId: registrations.categoryId })
      .from(registrations)
      .where(eq(registrations.id, registrationId)),
  ]);

  return { problem: problemRows[0], registration: registrationRows[0] };
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

  // 429, not 403: the queue treats 403 as "the code changed, go ask again" and
  // clears it. Being throttled is temporary, so it has to stay non-terminal —
  // the pending attempts wait on the phone and the next tick retries.
  const key = clientKey(request);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados códigos incorrectos. Espera unos minutos.' },
      { status: 429 },
    );
  }

  const { problem, registration } = await loadScope(db, input.registrationId, input.problemId);
  const verdict = attemptVerdict(problem, registration, input.judgeCode);

  if (verdict === 'bad-code') {
    recordFailure(key);
    return NextResponse.json(
      { ok: false, error: 'El código del evento no es correcto.' },
      { status: 403 },
    );
  }

  if (verdict === 'out-of-scope') {
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
