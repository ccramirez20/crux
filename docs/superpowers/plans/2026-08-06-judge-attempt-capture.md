# Judge Attempt Capture (Offline-First) + Block QR Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a judge open a link on their phone — no login — capture boulder/lead attempts for a block, have those writes survive dropped wifi, and sync without double-counting once signal returns. Give organizers a QR per block that jumps a judge straight into that block's capture screen.

**Architecture:** A new public `(judge)` route group loads an event's full category/round/problem/registration tree once per page load (no offline caching of that reference data — only writes need to survive offline). Captured attempts go into a client-side IndexedDB queue keyed by a client-generated `clientAttemptId`, drained serially (one in-flight request at a time) to a new idempotent `POST /api/attempts` route handler, so the server-assigned `sequence` column preserves real capture order even across corrections. The organizer panel gets a client-side QR generator (`qrcode` package) per block, encoding a deep link that pre-locks the judge screen to that block.

**Tech Stack:** Next.js 15 App Router (server components, a route handler, client components), Drizzle (`@crux/db`), Zod, native IndexedDB, `qrcode` (new dependency).

## Global Constraints

- UI copy in Spanish (es-CO); identifiers/code in English. (CLAUDE.md)
- Zod validates every action/route input; the type is inferred from the schema. (CLAUDE.md)
- No `any`. No `as` to silence the compiler. (CLAUDE.md)
- No DB schema changes — `attempts` already has everything this slice needs (`clientAttemptId` unique, `sequence` bigserial, all scoreable fields nullable except `top`/`zone`). (spec)
- No auth on any judge-facing route or the sync endpoint — the link itself is the access control, matching `/inscripcion/[slug]`'s existing posture. (spec, domain decision #5)
- `attempts.sequence` (server-assigned `bigserial`) is the only trusted correction tiebreak — never the client's `capturedAt`. The sync queue MUST drain serially (await each response before sending the next), never concurrently, so capture order and sequence order match. (spec: Offline/Sync mechanics)
- A `clientAttemptId` unique-violation on insert is a SUCCESS (idempotent re-delivery), not an error. (spec, domain decision #3)
- Reference data (categories/rounds/problems/registrations) loads once per page load and lives only in React state — not persisted to IndexedDB. Only the attempt write queue is offline-resilient. (spec, explicitly scoped)
- New dependency: `qrcode` (approved) — used only in the organizer panel, client-side, no server round-trip for image generation.
- `isUniqueViolation` gets extracted to `apps/web/lib/db-errors.ts` once this slice adds a third call site (past CLAUDE.md's "≥3 uses" bar for an abstraction). (spec)
- Out of scope: wiring the leaderboard to `scoreRound()`; any judge-facing scores/standings view; rate limiting on the sync endpoint; editing `bibNumber` from the judge screen; caching reference data offline; a judge account/role. (spec: Explicitly deferred)

---

### Task 1: Extract `isUniqueViolation` to a shared helper

**Files:**
- Create: `apps/web/lib/db-errors.ts`
- Modify: `apps/web/app/(public)/inscripcion/[slug]/actions.ts`
- Modify: `apps/web/app/(organizer)/panel/events/new/actions.ts`

**Interfaces:**
- Produces: `isUniqueViolation(error: unknown): boolean` — detects Postgres error code `23505`, including Drizzle's `.cause`-wrapped form.
- Consumed by: Task 2's `POST /api/attempts` route (new third call site — the reason for this extraction).

- [ ] **Step 1: Create the shared helper**

Create `apps/web/lib/db-errors.ts`:

```ts
function hasPostgresUniqueCode(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

// Drizzle wraps the driver error in a query-failure Error whose `.cause` holds
// the real postgres.js PostgresError (where `.code` actually lives) — checking
// only the top-level error lets a duplicate-key insert crash as a 500 instead
// of being handled as the expected condition it is.
export function isUniqueViolation(error: unknown): boolean {
  return (
    hasPostgresUniqueCode(error) ||
    (typeof error === 'object' && error !== null && 'cause' in error && hasPostgresUniqueCode(error.cause))
  );
}
```

- [ ] **Step 2: Update the inscripción action to import it**

In `apps/web/app/(public)/inscripcion/[slug]/actions.ts`, remove the local `hasPostgresUniqueCode` and `isUniqueViolation` function definitions (currently near the top of the file, right after the imports), and add to the imports:

```ts
import { isUniqueViolation } from '@/lib/db-errors';
```

Everything else in the file (both call sites of `isUniqueViolation`) stays unchanged — same name, same signature.

- [ ] **Step 3: Update the event-creation action to import it**

In `apps/web/app/(organizer)/panel/events/new/actions.ts`, remove the local `isUniqueViolation` function definition, and add to the imports:

```ts
import { isUniqueViolation } from '@/lib/db-errors';
```

The one call site stays unchanged.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/db-errors.ts "apps/web/app/(public)/inscripcion/[slug]/actions.ts" "apps/web/app/(organizer)/panel/events/new/actions.ts"
git commit -m "refactor(web): extract isUniqueViolation into a shared helper"
```

---

### Task 2: `POST /api/attempts` sync endpoint

**Files:**
- Create: `apps/web/app/api/attempts/route.ts`

**Interfaces:**
- Consumes: `isUniqueViolation` from `@/lib/db-errors` (Task 1); `attempts`, `eq`, `problems`, `registrations`, `rounds` from `@crux/db`; `getDb` from `@/lib/db`.
- Produces: `POST /api/attempts` accepting `{ clientAttemptId, registrationId, problemId, judgeLabel, top, topAttempts, zone, zoneAttempts, height, capturedAt }`, returning `{ ok: true }` or `{ ok: false, error: string }` as JSON.
- Consumed by: Task 3's sync drain loop (`fetch('/api/attempts', { method: 'POST', body: JSON.stringify(attempt) })`).

- [ ] **Step 1: Write the route handler**

Create `apps/web/app/api/attempts/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attempts, categories, eq, problems, registrations, rounds } from '@crux/db';
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

async function belongToSameEvent(
  db: ReturnType<typeof getDb>,
  registrationId: string,
  problemId: string,
): Promise<boolean> {
  const [registrationRow] = await db
    .select({ eventId: registrations.eventId })
    .from(registrations)
    .where(eq(registrations.id, registrationId));
  if (!registrationRow) {
    return false;
  }

  const [problemRow] = await db
    .select({ eventId: categories.eventId })
    .from(problems)
    .innerJoin(rounds, eq(problems.roundId, rounds.id))
    .innerJoin(categories, eq(rounds.categoryId, categories.id))
    .where(eq(problems.id, problemId));
  if (!problemRow) {
    return false;
  }

  return registrationRow.eventId === problemRow.eventId;
}

export async function POST(request: Request): Promise<NextResponse<SyncResult>> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = attemptInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos de intento inválidos.' }, { status: 400 });
  }

  const input: AttemptInput = parsed.data;
  const db = getDb();

  const inScope = await belongToSameEvent(db, input.registrationId, input.problemId);
  if (!inScope) {
    return NextResponse.json(
      { ok: false, error: 'La inscripción y el bloque no pertenecen al mismo evento.' },
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 3: Manual verification**

Run: `pnpm dev`, then from another terminal:

```bash
curl -X POST http://localhost:3000/api/attempts -H "Content-Type: application/json" -d "{\"clientAttemptId\":\"00000000-0000-0000-0000-000000000001\",\"registrationId\":\"<a real registrationId from your DB>\",\"problemId\":\"<a real problemId from the same event>\",\"judgeLabel\":\"Test\",\"top\":true,\"topAttempts\":1,\"zone\":true,\"zoneAttempts\":1,\"height\":null,\"capturedAt\":\"2026-08-06T12:00:00.000Z\"}"
```

Expected: `{"ok":true}`, and a new row in `attempts` (check via `pnpm db:studio`). Re-run the exact same `curl` command a second time — expected: still `{"ok":true}`, and still only **one** row (idempotent). Change only `problemId` to one from a *different* event and re-run — expected: `{"ok":false,"error":"La inscripción y el bloque no pertenecen al mismo evento."}`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/attempts/route.ts
git commit -m "feat(web): add idempotent POST /api/attempts sync endpoint"
```

---

### Task 3: `attempt-queue.ts` — IndexedDB write queue

**Files:**
- Create: `apps/web/app/(judge)/juzgar/[slug]/attempt-queue.ts`

**Interfaces:**
- Produces: `interface PendingAttempt` (the full attempt payload shape, matching Task 2's `AttemptInput` field-for-field, plus nothing else).
- Produces: `addPending(attempt: PendingAttempt): Promise<void>`
- Produces: `listPending(): Promise<PendingAttempt[]>`
- Produces: `removeSynced(clientAttemptId: string): Promise<void>`
- Consumed by: Task 5 (enqueue on submit) and Task 6 (drain loop, "últimos intentos" list).

This module is plain TypeScript (no React) so it can be reasoned about and manually exercised independently of the component tree — `apps/web` has no test runner (CLAUDE.md/spec: standing one up is out of scope for this slice), so verification here is a manual browser-console check, not an automated test.

- [ ] **Step 1: Write the module**

Create `apps/web/app/(judge)/juzgar/[slug]/attempt-queue.ts`:

```ts
export interface PendingAttempt {
  clientAttemptId: string;
  registrationId: string;
  problemId: string;
  judgeLabel: string;
  top: boolean;
  topAttempts: number | null;
  zone: boolean;
  zoneAttempts: number | null;
  height: number | null;
  capturedAt: string;
}

const DB_NAME = 'crux-judge-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pendingAttempts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'clientAttemptId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addPending(attempt: PendingAttempt): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(attempt);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPending(): Promise<PendingAttempt[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PendingAttempt[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeSynced(clientAttemptId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(clientAttemptId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS. (`IDBDatabase`/`indexedDB` are part of the `dom` lib already in `apps/web/tsconfig.json`'s target — no new type dependency needed.)

- [ ] **Step 3: Defer functional verification to Tasks 5-6**

This module has no consumer yet (`capture-app.tsx` doesn't call it until Task 5). There's no route serving it in isolation to exercise from a browser console, so don't attempt to. Its three functions get exercised for real once Task 5 wires `addPending` into the capture form's submit handler and Task 6 wires `listPending`/`removeSynced` into the sync loop — that's where "does this actually read/write IndexedDB correctly" gets verified, against the real UI. Nothing to run here beyond the typecheck in Step 2.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(judge)/juzgar/[slug]/attempt-queue.ts"
git commit -m "feat(web): add IndexedDB write queue for offline attempt capture"
```

---

### Task 4: Judge routes + data loading + block picker

**Files:**
- Create: `apps/web/app/(judge)/juzgar/[slug]/page.tsx`
- Create: `apps/web/app/(judge)/juzgar/[slug]/[problemId]/page.tsx`
- Create: `apps/web/app/(judge)/juzgar/[slug]/block-picker.tsx`
- Create: `apps/web/app/(judge)/juzgar/[slug]/capture-app.tsx` (skeleton — judge name prompt + block picker only; the capture form/list/sync land in Tasks 5-6)

**Interfaces:**
- Produces: `type JudgeCategory = { id: string; name: string; rounds: { id: string; type: string; order: number; problems: { id: string; number: number; name: string | null }[] }[] }`
- Produces: `type JudgeRegistration = { id: string; bibNumber: string | null; categoryId: string; athleteFullName: string }`
- Produces: `<CaptureApp event={{ id, slug, discipline }} categories={JudgeCategory[]} registrations={JudgeRegistration[]} lockedProblemId={string | null} />`
- Produces: `<BlockPicker categories={JudgeCategory[]} onSelect={(problemId: string) => void} />`
- Consumed by: Task 5 (adds the capture form below the picker/locked-block header inside `capture-app.tsx`).

- [ ] **Step 1: Write the free-navigation page**

Create `apps/web/app/(judge)/juzgar/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { athletes, categories, eq, events, inArray, problems, registrations, rounds } from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { CaptureApp } from './capture-app';

export default async function JuzgarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();

  const [event] = await db
    .select({ id: events.id, slug: events.slug, discipline: events.discipline })
    .from(events)
    .where(eq(events.slug, slug));
  if (!event) {
    notFound();
  }

  const eventCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.eventId, event.id))
    .orderBy(categories.name);
  const categoryIds = eventCategories.map((c) => c.id);

  const categoryRounds = categoryIds.length
    ? await db
        .select({ id: rounds.id, type: rounds.type, order: rounds.order, categoryId: rounds.categoryId })
        .from(rounds)
        .where(inArray(rounds.categoryId, categoryIds))
        .orderBy(rounds.order)
    : [];
  const roundIds = categoryRounds.map((r) => r.id);

  const roundProblems = roundIds.length
    ? await db
        .select({ id: problems.id, number: problems.number, name: problems.name, roundId: problems.roundId })
        .from(problems)
        .where(inArray(problems.roundId, roundIds))
        .orderBy(problems.number)
    : [];

  const structuredCategories = eventCategories.map((category) => ({
    ...category,
    rounds: categoryRounds
      .filter((round) => round.categoryId === category.id)
      .map((round) => ({
        ...round,
        problems: roundProblems.filter((problem) => problem.roundId === round.id),
      })),
  }));

  const eventRegistrations = categoryIds.length
    ? await db
        .select({
          id: registrations.id,
          bibNumber: registrations.bibNumber,
          categoryId: registrations.categoryId,
          athleteFullName: athletes.fullName,
        })
        .from(registrations)
        .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
        .where(inArray(registrations.categoryId, categoryIds))
    : [];

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <h1 className="font-display text-2xl font-bold">Juzgar</h1>
      <CaptureApp
        event={event}
        categories={structuredCategories}
        registrations={eventRegistrations}
        lockedProblemId={null}
      />
    </main>
  );
}
```

- [ ] **Step 2: Write the QR deep-link page**

Create `apps/web/app/(judge)/juzgar/[slug]/[problemId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import {
  athletes,
  categories,
  eq,
  events,
  inArray,
  problems,
  registrations,
  rounds,
} from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { CaptureApp } from '../capture-app';

export default async function JuzgarBloquePage({
  params,
}: {
  params: Promise<{ slug: string; problemId: string }>;
}) {
  const { slug, problemId } = await params;
  const db = getDb();

  const [event] = await db
    .select({ id: events.id, slug: events.slug, discipline: events.discipline })
    .from(events)
    .where(eq(events.slug, slug));
  if (!event) {
    notFound();
  }

  const [problemRow] = await db
    .select({ id: problems.id, eventId: categories.eventId })
    .from(problems)
    .innerJoin(rounds, eq(problems.roundId, rounds.id))
    .innerJoin(categories, eq(rounds.categoryId, categories.id))
    .where(eq(problems.id, problemId));
  if (!problemRow || problemRow.eventId !== event.id) {
    notFound();
  }

  const eventCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.eventId, event.id))
    .orderBy(categories.name);
  const categoryIds = eventCategories.map((c) => c.id);

  const categoryRounds = categoryIds.length
    ? await db
        .select({ id: rounds.id, type: rounds.type, order: rounds.order, categoryId: rounds.categoryId })
        .from(rounds)
        .where(inArray(rounds.categoryId, categoryIds))
        .orderBy(rounds.order)
    : [];
  const roundIds = categoryRounds.map((r) => r.id);

  const roundProblems = roundIds.length
    ? await db
        .select({ id: problems.id, number: problems.number, name: problems.name, roundId: problems.roundId })
        .from(problems)
        .where(inArray(problems.roundId, roundIds))
        .orderBy(problems.number)
    : [];

  const structuredCategories = eventCategories.map((category) => ({
    ...category,
    rounds: categoryRounds
      .filter((round) => round.categoryId === category.id)
      .map((round) => ({
        ...round,
        problems: roundProblems.filter((problem) => problem.roundId === round.id),
      })),
  }));

  const eventRegistrations = categoryIds.length
    ? await db
        .select({
          id: registrations.id,
          bibNumber: registrations.bibNumber,
          categoryId: registrations.categoryId,
          athleteFullName: athletes.fullName,
        })
        .from(registrations)
        .innerJoin(athletes, eq(registrations.athleteId, athletes.id))
        .where(inArray(registrations.categoryId, categoryIds))
    : [];

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <h1 className="font-display text-2xl font-bold">Juzgar</h1>
      <CaptureApp
        event={event}
        categories={structuredCategories}
        registrations={eventRegistrations}
        lockedProblemId={problemId}
      />
    </main>
  );
}
```

**Note for the implementer:** these two pages duplicate the same 4-query data-loading block. This plan does not extract it into a shared function — with exactly 2 call sites it doesn't yet cross CLAUDE.md's "≥3 uses" bar the way `isUniqueViolation` did in Task 1. If a third page ever needs this same tree (e.g. a future public leaderboard page), extract a `loadJudgeEventData(slug)` helper then, not now.

- [ ] **Step 3: Write the block picker**

Create `apps/web/app/(judge)/juzgar/[slug]/block-picker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { fieldClass } from '@/lib/ui';

type Problem = { id: string; number: number; name: string | null };
type Round = { id: string; type: string; order: number; problems: Problem[] };
type Category = { id: string; name: string; rounds: Round[] };

export function BlockPicker({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (problemId: string) => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [roundId, setRoundId] = useState('');

  const category = categories.find((c) => c.id === categoryId);
  const round = category?.rounds.find((r) => r.id === roundId);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <select
        value={categoryId}
        onChange={(event) => {
          setCategoryId(event.target.value);
          setRoundId('');
        }}
        className={fieldClass}
      >
        <option value="">Elige categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {category && (
        <select value={roundId} onChange={(event) => setRoundId(event.target.value)} className={fieldClass}>
          <option value="">Elige ronda</option>
          {category.rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.type}
            </option>
          ))}
        </select>
      )}

      {round && (
        <select defaultValue="" onChange={(event) => event.target.value && onSelect(event.target.value)} className={fieldClass}>
          <option value="">Elige bloque</option>
          {round.problems.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.number} {p.name ?? ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the skeleton `CaptureApp` (judge name + block selection only)**

Create `apps/web/app/(judge)/juzgar/[slug]/capture-app.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { fieldClass, primaryButtonClass } from '@/lib/ui';
import { BlockPicker } from './block-picker';

type Problem = { id: string; number: number; name: string | null };
type Round = { id: string; type: string; order: number; problems: Problem[] };
type Category = { id: string; name: string; rounds: Round[] };
type Registration = { id: string; bibNumber: string | null; categoryId: string; athleteFullName: string };
type Event = { id: string; slug: string; discipline: string };

const JUDGE_NAME_KEY = 'crux-judge-name';

function findProblem(categories: Category[], problemId: string): { problem: Problem; categoryId: string } | null {
  for (const category of categories) {
    for (const round of category.rounds) {
      const problem = round.problems.find((p) => p.id === problemId);
      if (problem) {
        return { problem, categoryId: category.id };
      }
    }
  }
  return null;
}

export function CaptureApp({
  event,
  categories,
  registrations,
  lockedProblemId,
}: {
  event: Event;
  categories: Category[];
  registrations: Registration[];
  lockedProblemId: string | null;
}) {
  const [judgeName, setJudgeName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [activeProblemId, setActiveProblemId] = useState<string | null>(lockedProblemId);
  const [isLocked, setIsLocked] = useState(lockedProblemId !== null);

  useEffect(() => {
    setJudgeName(localStorage.getItem(JUDGE_NAME_KEY));
  }, []);

  function saveJudgeName() {
    if (!nameDraft.trim()) return;
    localStorage.setItem(JUDGE_NAME_KEY, nameDraft.trim());
    setJudgeName(nameDraft.trim());
  }

  if (judgeName === null) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="text"
          placeholder="Tu nombre"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          className={fieldClass}
        />
        <button type="button" onClick={saveJudgeName} className={primaryButtonClass}>
          Empezar a juzgar
        </button>
      </div>
    );
  }

  const active = activeProblemId ? findProblem(categories, activeProblemId) : null;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <p className="text-sm text-muted">
        Juez: {judgeName}{' '}
        <button
          type="button"
          className="text-pine underline"
          onClick={() => {
            const next = prompt('Nuevo nombre', judgeName);
            if (next?.trim()) {
              localStorage.setItem(JUDGE_NAME_KEY, next.trim());
              setJudgeName(next.trim());
            }
          }}
        >
          cambiar
        </button>
      </p>

      {active && isLocked && (
        <div className="flex items-center justify-between rounded-lg border border-cardborder bg-white p-3">
          <span className="font-display font-semibold">
            Bloque #{active.problem.number} {active.problem.name ?? ''}
          </span>
          <button type="button" className="text-sm text-pine underline" onClick={() => setIsLocked(false)}>
            cambiar de bloque
          </button>
        </div>
      )}

      {!isLocked && (
        <BlockPicker
          categories={categories}
          onSelect={(problemId) => {
            setActiveProblemId(problemId);
            setIsLocked(true);
          }}
        />
      )}

      {/* Attempt capture form, recent-attempts list, and sync status land in Tasks 5-6. */}
    </div>
  );
}
```

**Interfaces this exposes for Task 5** (do not implement yet, just note the seam): once `active` and `isLocked` are both truthy, Task 5 renders an `<AttemptCapture>` below the block header, passing `event.discipline`, `active.problem.id`, and `registrations.filter((r) => r.categoryId === active.categoryId)`.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Manual verification**

Run: `pnpm dev`. Using an event/category/round/problem you already have (from prior slices' seed data or the organizer panel), visit `http://localhost:3000/juzgar/<slug>`. Expected: name prompt appears once, then the category → round → bloque picker; selecting a block shows its header and a "cambiar de bloque" link. Reload the page — expected: judge name is remembered (no prompt), block selection resets to the picker (session state, not persisted, which is correct — only the write queue persists). Visit `http://localhost:3000/juzgar/<slug>/<problemId>` directly — expected: block header shown immediately, locked, no picker. Visit with a `problemId` from a different event — expected: 404.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(judge)"
git commit -m "feat(web): add judge routes, data loading, and block picker"
```

---

### Task 5: Attempt capture form (bib entry, discipline-conditional fields, enqueue)

**Files:**
- Create: `apps/web/app/(judge)/juzgar/[slug]/attempt-capture.tsx`
- Modify: `apps/web/app/(judge)/juzgar/[slug]/capture-app.tsx`

**Interfaces:**
- Consumes: `addPending`, `type PendingAttempt` from `./attempt-queue` (Task 3).
- Produces: `<AttemptCapture discipline={string} problemId={string} judgeName={string} registrations={Registration[]} />` — bib lookup, discipline-conditional fields, submit enqueues via `addPending` and clears the form for the next athlete.
- Consumed by: `capture-app.tsx` (replaces the Task 4 comment placeholder).

- [ ] **Step 1: Write `AttemptCapture`**

Create `apps/web/app/(judge)/juzgar/[slug]/attempt-capture.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { fieldClass, primaryButtonClass } from '@/lib/ui';
import { addPending } from './attempt-queue';

type Registration = { id: string; bibNumber: string | null; categoryId: string; athleteFullName: string };

export function AttemptCapture({
  discipline,
  problemId,
  judgeName,
  registrations,
}: {
  discipline: string;
  problemId: string;
  judgeName: string;
  registrations: Registration[];
}) {
  const [bib, setBib] = useState('');
  const [top, setTop] = useState(false);
  const [topAttempts, setTopAttempts] = useState('');
  const [zone, setZone] = useState(false);
  const [zoneAttempts, setZoneAttempts] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const matchedRegistration = registrations.find((r) => r.bibNumber === bib);

  function resetForm() {
    setBib('');
    setTop(false);
    setTopAttempts('');
    setZone(false);
    setZoneAttempts('');
    setHeight('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!matchedRegistration) {
      setError('Ese dorsal no corresponde a nadie inscrito en esta categoría.');
      return;
    }

    await addPending({
      clientAttemptId: crypto.randomUUID(),
      registrationId: matchedRegistration.id,
      problemId,
      judgeLabel: judgeName,
      top,
      topAttempts: topAttempts ? Number(topAttempts) : null,
      zone,
      zoneAttempts: zoneAttempts ? Number(zoneAttempts) : null,
      height: height ? Number(height) : null,
      capturedAt: new Date().toISOString(),
    });

    setSavedMessage(`Guardado para ${matchedRegistration.athleteFullName} (dorsal ${bib}).`);
    resetForm();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-cardborder bg-white p-3">
      <input
        type="text"
        inputMode="numeric"
        placeholder="Dorsal"
        value={bib}
        onChange={(event) => setBib(event.target.value)}
        required
        className={fieldClass}
      />
      {bib && !matchedRegistration && (
        <p className="text-sm text-red-700">Dorsal no encontrado en esta categoría.</p>
      )}
      {matchedRegistration && <p className="text-sm text-muted">{matchedRegistration.athleteFullName}</p>}

      {discipline === 'boulder' ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={top} onChange={(event) => setTop(event.target.checked)} />
            Top
          </label>
          <input
            type="number"
            min={1}
            placeholder="Intentos a top"
            value={topAttempts}
            onChange={(event) => setTopAttempts(event.target.value)}
            className={fieldClass}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={zone} onChange={(event) => setZone(event.target.checked)} />
            Zona
          </label>
          <input
            type="number"
            min={1}
            placeholder="Intentos a zona"
            value={zoneAttempts}
            onChange={(event) => setZoneAttempts(event.target.value)}
            className={fieldClass}
          />
        </>
      ) : (
        <input
          type="number"
          min={0}
          step="0.1"
          placeholder="Altura alcanzada"
          value={height}
          onChange={(event) => setHeight(event.target.value)}
          className={fieldClass}
        />
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {savedMessage && <p className="text-sm text-pine">{savedMessage}</p>}
      <button type="submit" className={primaryButtonClass}>
        Guardar intento
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Wire it into `CaptureApp`**

In `apps/web/app/(judge)/juzgar/[slug]/capture-app.tsx`:

Add to the imports:

```ts
import { AttemptCapture } from './attempt-capture';
```

Replace the comment placeholder:

```tsx
      {/* Attempt capture form, recent-attempts list, and sync status land in Tasks 5-6. */}
```

with:

```tsx
      {active && isLocked && (
        <AttemptCapture
          discipline={event.discipline}
          problemId={active.problem.id}
          judgeName={judgeName}
          registrations={registrations.filter((r) => r.categoryId === active.categoryId)}
        />
      )}
```

(Note: this duplicates the `active && isLocked` guard already around the block-header `<div>` above it in the same file — that's fine, both blocks render together whenever a block is active and locked; don't try to merge them into one wrapping conditional in a way that changes the block header's own markup structure.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`. Visit `/juzgar/<slug>/<problemId>` for a **boulder** event's block. Expected: dorsal input, then top/zona checkboxes and attempt-count inputs. Enter a bib that exists in that category — expected: athlete name appears. Fill in top+attempts, submit — expected: "Guardado para <nombre>..." message, form clears, bib field empty again ready for the next athlete. Enter a bib that does NOT exist — expected: inline error, no crash. Repeat against a **lead** event's block — expected: a single height input instead of top/zone fields. Open browser devtools → Application → IndexedDB → `crux-judge-queue` → `pendingAttempts` — expected: each submitted attempt appears as a row there (nothing has synced yet — that's Task 6).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(judge)/juzgar/[slug]/attempt-capture.tsx" "apps/web/app/(judge)/juzgar/[slug]/capture-app.tsx"
git commit -m "feat(web): add discipline-aware attempt capture form, enqueued to IndexedDB"
```

---

### Task 6: Sync drain loop, "últimos intentos" list, and corrections

**Files:**
- Create: `apps/web/app/(judge)/juzgar/[slug]/recent-attempts.tsx`
- Modify: `apps/web/app/(judge)/juzgar/[slug]/attempt-capture.tsx`

**Interfaces:**
- Consumes: `listPending`, `removeSynced`, `type PendingAttempt` from `./attempt-queue` (Task 3).
- Produces: `<RecentAttempts attempts={PendingAttempt[]} pendingIds={Set<string>} onSelect={(attempt: PendingAttempt) => void} />` — read-only list, newest first.
- Modifies `AttemptCapture` to: own the drain-loop `setInterval`, own the merged "server-loaded + still-queued" list for the active block, and support tap-to-prefill for corrections.

This task does not add a way to fetch previously-synced attempts from the server for the active block — the spec's "recent attempts" list is scoped to *this browser session's* captures (server-loaded history for a block a judge didn't personally just capture is a read-path feature the spec explicitly doesn't require; a judge only needs to see and correct what *they* just entered). Keep `RecentAttempts` fed purely from the local IndexedDB queue plus an in-memory list of this session's already-synced items (so a corrected entry doesn't visually disappear from the list the instant it syncs).

- [ ] **Step 1: Write `RecentAttempts`**

Create `apps/web/app/(judge)/juzgar/[slug]/recent-attempts.tsx`:

```tsx
import type { PendingAttempt } from './attempt-queue';

export function RecentAttempts({
  attempts,
  pendingIds,
  onSelect,
}: {
  attempts: PendingAttempt[];
  pendingIds: Set<string>;
  onSelect: (attempt: PendingAttempt) => void;
}) {
  if (attempts.length === 0) {
    return null;
  }

  const sorted = [...attempts].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-bark">Últimos intentos</p>
      <ul className="flex flex-col gap-1 text-sm">
        {sorted.map((attempt) => (
          <li key={attempt.clientAttemptId}>
            <button
              type="button"
              onClick={() => onSelect(attempt)}
              className="flex w-full items-center justify-between rounded border border-cardborder bg-white px-2 py-1 text-left"
            >
              <span>
                {attempt.top ? 'Top' : attempt.zone ? 'Zona' : attempt.height != null ? `${attempt.height}m` : 'Sin logro'}
              </span>
              {pendingIds.has(attempt.clientAttemptId) && (
                <span className="text-xs text-muted">sin sincronizar</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Add the drain loop, session history, and correction pre-fill to `AttemptCapture`**

Replace the full contents of `apps/web/app/(judge)/juzgar/[slug]/attempt-capture.tsx` with:

```tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { fieldClass, primaryButtonClass } from '@/lib/ui';
import { addPending, listPending, removeSynced, type PendingAttempt } from './attempt-queue';
import { RecentAttempts } from './recent-attempts';

type Registration = { id: string; bibNumber: string | null; categoryId: string; athleteFullName: string };

const SYNC_INTERVAL_MS = 5000;

export function AttemptCapture({
  discipline,
  problemId,
  judgeName,
  registrations,
}: {
  discipline: string;
  problemId: string;
  judgeName: string;
  registrations: Registration[];
}) {
  const [bib, setBib] = useState('');
  const [top, setTop] = useState(false);
  const [topAttempts, setTopAttempts] = useState('');
  const [zone, setZone] = useState(false);
  const [zoneAttempts, setZoneAttempts] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [sessionAttempts, setSessionAttempts] = useState<PendingAttempt[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const matchedRegistration = registrations.find((r) => r.bibNumber === bib);

  // Serial drain: one in-flight request at a time, so the server-assigned
  // `sequence` preserves real capture order (see spec: Offline/Sync
  // mechanics — this is why it's a hand-rolled loop, not Promise.all).
  useEffect(() => {
    let cancelled = false;

    async function drain() {
      const pending = await listPending();
      const forThisBlock = pending.filter((a) => a.problemId === problemId);
      setPendingIds(new Set(pending.map((a) => a.clientAttemptId)));

      for (const attempt of forThisBlock) {
        if (cancelled) return;
        try {
          const response = await fetch('/api/attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attempt),
          });
          const result: { ok: boolean } = await response.json();
          if (result.ok) {
            await removeSynced(attempt.clientAttemptId);
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(attempt.clientAttemptId);
              return next;
            });
          }
        } catch {
          // Network failure — leave it queued, next tick retries.
          break;
        }
      }
    }

    const interval = setInterval(drain, SYNC_INTERVAL_MS);
    void drain();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [problemId]);

  function resetForm() {
    setBib('');
    setTop(false);
    setTopAttempts('');
    setZone(false);
    setZoneAttempts('');
    setHeight('');
  }

  function loadForCorrection(attempt: PendingAttempt) {
    const registration = registrations.find((r) => r.id === attempt.registrationId);
    setBib(registration?.bibNumber ?? '');
    setTop(attempt.top);
    setTopAttempts(attempt.topAttempts != null ? String(attempt.topAttempts) : '');
    setZone(attempt.zone);
    setZoneAttempts(attempt.zoneAttempts != null ? String(attempt.zoneAttempts) : '');
    setHeight(attempt.height != null ? String(attempt.height) : '');
    setSavedMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!matchedRegistration) {
      setError('Ese dorsal no corresponde a nadie inscrito en esta categoría.');
      return;
    }

    const attempt: PendingAttempt = {
      clientAttemptId: crypto.randomUUID(),
      registrationId: matchedRegistration.id,
      problemId,
      judgeLabel: judgeName,
      top,
      topAttempts: topAttempts ? Number(topAttempts) : null,
      zone,
      zoneAttempts: zoneAttempts ? Number(zoneAttempts) : null,
      height: height ? Number(height) : null,
      capturedAt: new Date().toISOString(),
    };

    await addPending(attempt);
    setSessionAttempts((prev) => [...prev, attempt]);
    setPendingIds((prev) => new Set(prev).add(attempt.clientAttemptId));

    setSavedMessage(`Guardado para ${matchedRegistration.athleteFullName} (dorsal ${bib}).`);
    resetForm();
  }

  const attemptsForThisBlock = sessionAttempts.filter((a) => a.problemId === problemId);

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-cardborder bg-white p-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Dorsal"
          value={bib}
          onChange={(event) => setBib(event.target.value)}
          required
          className={fieldClass}
        />
        {bib && !matchedRegistration && (
          <p className="text-sm text-red-700">Dorsal no encontrado en esta categoría.</p>
        )}
        {matchedRegistration && <p className="text-sm text-muted">{matchedRegistration.athleteFullName}</p>}

        {discipline === 'boulder' ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={top} onChange={(event) => setTop(event.target.checked)} />
              Top
            </label>
            <input
              type="number"
              min={1}
              placeholder="Intentos a top"
              value={topAttempts}
              onChange={(event) => setTopAttempts(event.target.value)}
              className={fieldClass}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={zone} onChange={(event) => setZone(event.target.checked)} />
              Zona
            </label>
            <input
              type="number"
              min={1}
              placeholder="Intentos a zona"
              value={zoneAttempts}
              onChange={(event) => setZoneAttempts(event.target.value)}
              className={fieldClass}
            />
          </>
        ) : (
          <input
            type="number"
            min={0}
            step="0.1"
            placeholder="Altura alcanzada"
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            className={fieldClass}
          />
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}
        {savedMessage && <p className="text-sm text-pine">{savedMessage}</p>}
        <button type="submit" className={primaryButtonClass}>
          Guardar intento
        </button>
      </form>

      <p className="text-xs text-muted">
        {pendingIds.size > 0 ? `${pendingIds.size} sin sincronizar` : 'Todo sincronizado'}
      </p>

      <RecentAttempts attempts={attemptsForThisBlock} pendingIds={pendingIds} onSelect={loadForCorrection} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 4: Manual verification — happy path sync**

Run: `pnpm dev`. Visit a block's judge URL, submit an attempt. Expected: "1 sin sincronizar" appears, then within 5 seconds flips to "Todo sincronizado" (check `pnpm db:studio` — the row is in `attempts`). The entry also appears in "Últimos intentos" without the "sin sincronizar" tag once synced.

- [ ] **Step 5: Manual verification — offline capture and catch-up**

In devtools, Network tab, set throttling to "Offline". Submit two attempts. Expected: both appear in "Últimos intentos" tagged "sin sincronizar", counter shows "2 sin sincronizar", no crash, IndexedDB (Application tab) shows both rows. Set throttling back to "Online". Expected: within one 5s tick, both sync (check `pnpm db:studio` for 2 new rows with sequential `sequence` values in the same order they were captured), tags clear, counter reads "Todo sincronizado".

- [ ] **Step 6: Manual verification — correction**

Submit an attempt marking `top: false`. Tap it in "Últimos intentos" — expected: form pre-fills with those values. Change to `top: true`, submit. Expected: a *second* row appears in "Últimos intentos" (not a replacement of the first), both eventually sync. In `pnpm db:studio`, confirm two `attempts` rows exist for that `(registrationId, problemId)` with different `sequence` values, the corrected one higher.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(judge)/juzgar/[slug]/recent-attempts.tsx" "apps/web/app/(judge)/juzgar/[slug]/attempt-capture.tsx"
git commit -m "feat(web): sync captured attempts serially, list recent entries, support corrections"
```

---

### Task 7: Organizer QR per block

**Files:**
- Modify: `apps/web/package.json` (add `qrcode` dependency)
- Create: `apps/web/app/(organizer)/panel/events/[id]/problem-qr.tsx`
- Modify: `apps/web/app/(organizer)/panel/events/[id]/event-structure.tsx`
- Modify: `apps/web/app/(organizer)/panel/events/[id]/page.tsx`

**Interfaces:**
- Produces: `<ProblemQr url={string} />` — renders a "Ver QR" toggle that shows a `qrcode`-generated `<img>` of that URL on click.
- `EventStructure` needs the event's `slug` (not previously passed) to build each block's judge URL — new required prop.

- [ ] **Step 1: Add the `qrcode` dependency**

In `apps/web/package.json`, add to `dependencies`:

```json
    "qrcode": "^1.5.4",
```

Also add a dev dependency for its types:

```json
    "@types/qrcode": "^1.5.5",
```

(Place `@types/qrcode` alphabetically among the existing `devDependencies` entries.)

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updates, `qrcode` and `@types/qrcode` resolve into `apps/web`'s `node_modules`.

- [ ] **Step 3: Write `ProblemQr`**

Create `apps/web/app/(organizer)/panel/events/[id]/problem-qr.tsx`:

```tsx
'use client';

import { useState } from 'react';
import QRCode from 'qrcode';

export function ProblemQr({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  async function toggle() {
    if (dataUrl) {
      setDataUrl(null);
      return;
    }
    const generated = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    setDataUrl(generated);
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button type="button" onClick={toggle} className="text-xs text-pine underline">
        {dataUrl ? 'Ocultar QR' : 'Ver QR'}
      </button>
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL can't go through next/image's remote optimizer
        <img src={dataUrl} alt={`QR para juzgar el bloque (${url})`} width={240} height={240} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pass the event's slug down to `EventStructure`**

In `apps/web/app/(organizer)/panel/events/[id]/page.tsx`, change the event query from:

```ts
  const [event] = await db
    .select({ id: events.id, name: events.name, ownerId: events.ownerId, scoringFormat: events.scoringFormat })
    .from(events)
    .where(eq(events.id, eventId));
```

to:

```ts
  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      ownerId: events.ownerId,
      scoringFormat: events.scoringFormat,
      slug: events.slug,
    })
    .from(events)
    .where(eq(events.id, eventId));
```

and change the `<EventStructure ... />` call to also pass `slug={event.slug}`:

```tsx
      <EventStructure
        eventId={event.id}
        categories={structuredCategories}
        isOwner={event.ownerId === session.user.id}
        scoringFormat={event.scoringFormat}
        slug={event.slug}
      />
```

- [ ] **Step 5: Render `ProblemQr` next to each problem**

In `apps/web/app/(organizer)/panel/events/[id]/event-structure.tsx`, add to the imports:

```ts
import { ProblemQr } from './problem-qr';
```

Change the `EventStructure` props type from:

```ts
export function EventStructure({
  eventId,
  categories,
  isOwner,
  scoringFormat,
}: {
  eventId: string;
  categories: Category[];
  isOwner: boolean;
  scoringFormat: string;
}) {
```

to:

```ts
export function EventStructure({
  eventId,
  categories,
  isOwner,
  scoringFormat,
  slug,
}: {
  eventId: string;
  categories: Category[];
  isOwner: boolean;
  scoringFormat: string;
  slug: string;
}) {
```

Change the problems list rendering from:

```tsx
                          <ul className="text-sm">
                            {round.problems.map((problem) => (
                              <li key={problem.id}>
                                #{problem.number} {problem.name ?? ''}
                              </li>
                            ))}
                          </ul>
```

to:

```tsx
                          <ul className="flex flex-col gap-2 text-sm">
                            {round.problems.map((problem) => (
                              <li key={problem.id} className="flex items-center justify-between gap-2">
                                <span>
                                  #{problem.number} {problem.name ?? ''}
                                </span>
                                <ProblemQr
                                  url={`${typeof window !== 'undefined' ? window.location.origin : ''}/juzgar/${slug}/${problem.id}`}
                                />
                              </li>
                            ))}
                          </ul>
```

**Note for the implementer:** `EventStructure` and everything under it in this file is already `'use client'` (see the top of the file), so `window.location.origin` is safe to read here — this file never runs on the server. Don't move this computation into the parent server component's `page.tsx`; `window` isn't available there.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Manual verification**

Run: `pnpm dev`, open an event's detail page in the organizer panel, click "Ver QR" next to a block. Expected: a QR image appears. Scan it with a phone (same wifi network, or use `http://<your-machine-lan-ip>:3000` instead of `localhost` so a phone can actually reach it) — expected: phone opens `/juzgar/[slug]/[problemId]` with that block pre-locked.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml "apps/web/app/(organizer)/panel/events/[id]/problem-qr.tsx" "apps/web/app/(organizer)/panel/events/[id]/event-structure.tsx" "apps/web/app/(organizer)/panel/events/[id]/page.tsx"
git commit -m "feat(web): add per-block QR codes linking to the judge capture screen"
```

---

### Task 8: Full end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Whole-repo typecheck and test**

Run: `pnpm test && pnpm typecheck`
Expected: PASS across every package (no package other than `apps/web` was touched by this plan, so `@crux/core`/`@crux/scoring`/`@crux/db` should be unaffected — this step exists to catch anything unexpected).

- [ ] **Step 2: Full offline-to-online judge session**

Run: `pnpm dev`. As the organizer, open an event with a boulder category/round/block and at least 2 registered athletes with bib numbers set. Get that block's QR (Task 7) or its URL directly. As the "judge" (a second browser tab or a phone on the same network), open the URL, set a judge name, confirm the block is locked. Go offline (devtools throttling or airplane mode on a phone). Capture 3 attempts for 2 different bibs, including one correction (capture a mistake, then tap it and re-save corrected). Confirm all 3+ entries show in "Últimos intentos" tagged unsynced. Go back online. Confirm within ~5s all entries sync (`pnpm db:studio` shows the right rows with the right `sequence` order) and the UI's unsynced counter clears.

- [ ] **Step 3: Lead discipline path**

Repeat a short version of Step 2 against a `lead`-discipline event's block — confirm the height field appears instead of top/zone, and a height value syncs correctly.

- [ ] **Step 4: No regressions in existing flows**

Manually re-verify (per the prior slices' own verification steps) that organizer login, event creation, category/round/problem creation, and public registration still work — this plan didn't intentionally touch any of those, but Task 7 did modify `event-structure.tsx` and `page.tsx`, which those flows render through.
