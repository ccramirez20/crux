# Public Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an athlete self-register into an event category through a public, accountless page at `/inscripcion/[slug]`, without duplicating `athletes` rows for someone who already competed under the same document id.

**Architecture:** A pure eligibility function lands in `packages/core` (used both client-side, to filter the category dropdown, and server-side, to re-validate the submission). A new route group page loads the event + categories by slug; a client form component collects athlete data and calls a server action that dedupes the athlete by `documentId` and inserts the `Registration`.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Drizzle (`@crux/db`), Zod, Vitest (`packages/core` only — `apps/web` has no test runner).

## Global Constraints

- UI copy in Spanish (es-CO); identifiers/code in English. (CLAUDE.md)
- Zod validates every action's input; the TypeScript type is inferred from the schema, never the reverse. (CLAUDE.md)
- No `any`. No `as` to silence the compiler. (CLAUDE.md)
- Server actions return `{ ok: true } | { ok: false; error: string }` — exceptions only at unexpected IO failures, matching every existing `actions.ts` in the repo. (established pattern, `apps/web/app/(organizer)/panel/events/**/actions.ts`)
- `packages/core` stays IO-free — pure functions and types only. (CLAUDE.md)
- `packages/core` requires tests for anything non-trivial. (CLAUDE.md)
- No DB schema changes in this slice — the design confirmed everything needed already exists. (spec: Data model)
- No new dependencies.
- `category.gender === null` and `category.gender === 'mixed'` both mean "open to any gender." (spec: Flow, step 2)
- `bibNumber` stays `null` on insert — the organizer assigns it later. (spec: Flow, step 4)
- Out of scope for this slice: capacity limits, editing/cancelling a registration, email confirmation, a publish/open toggle on `events`, organizer-side manual registration, athlete-merge tooling. (spec: Explicitly deferred)

---

### Task 1: `isEligible()` in packages/core

**Files:**
- Create: `packages/core/src/eligibility.ts`
- Create: `packages/core/src/eligibility.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `isEligible(category: EligibilityCategory, birthDate: Date, gender: Gender, today?: Date): boolean`
- Produces: `parseDateOnly(value: string): Date` — parses a `'YYYY-MM-DD'` string as a local-time midnight `Date`, so age math isn't thrown off by UTC parsing.
- Produces: `interface EligibilityCategory { gender: Gender | null; minAge: number | null; maxAge: number | null }`
- Consumes: `Gender`, `GENDERS` already exported from `packages/core/src/index.ts`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/eligibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isEligible, parseDateOnly, type EligibilityCategory } from './eligibility';

const TODAY = new Date(2026, 7, 6); // 2026-08-06, fixed so age math isn't flaky

const OPEN: EligibilityCategory = { gender: null, minAge: null, maxAge: null };

describe('isEligible', () => {
  it('accepts any age and gender when the category has no restrictions', () => {
    expect(isEligible(OPEN, parseDateOnly('1990-01-01'), 'male', TODAY)).toBe(true);
    expect(isEligible(OPEN, parseDateOnly('2020-01-01'), 'female', TODAY)).toBe(true);
  });

  it('rejects a gender that does not match a gender-restricted category', () => {
    const category: EligibilityCategory = { gender: 'female', minAge: null, maxAge: null };
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'male', TODAY)).toBe(false);
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'female', TODAY)).toBe(true);
  });

  it('treats a "mixed" category as open to any gender, same as null', () => {
    const category: EligibilityCategory = { gender: 'mixed', minAge: null, maxAge: null };
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'male', TODAY)).toBe(true);
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'female', TODAY)).toBe(true);
  });

  it('enforces only minAge when maxAge is unset', () => {
    const category: EligibilityCategory = { gender: null, minAge: 18, maxAge: null };
    expect(isEligible(category, parseDateOnly('2010-01-01'), 'male', TODAY)).toBe(false); // 16
    expect(isEligible(category, parseDateOnly('2000-01-01'), 'male', TODAY)).toBe(true); // 26
  });

  it('enforces only maxAge when minAge is unset', () => {
    const category: EligibilityCategory = { gender: null, minAge: null, maxAge: 17 };
    expect(isEligible(category, parseDateOnly('2000-01-01'), 'male', TODAY)).toBe(false); // 26
    expect(isEligible(category, parseDateOnly('2010-01-01'), 'male', TODAY)).toBe(true); // 16
  });

  it('is exact at the lower age boundary, counting a birthday today as reached', () => {
    const category: EligibilityCategory = { gender: null, minAge: 18, maxAge: null };
    // Turns 18 exactly on TODAY (2026-08-06)
    expect(isEligible(category, parseDateOnly('2008-08-06'), 'male', TODAY)).toBe(true);
    // Turns 18 tomorrow — still 17 today
    expect(isEligible(category, parseDateOnly('2008-08-07'), 'male', TODAY)).toBe(false);
  });

  it('is exact at the upper age boundary', () => {
    const category: EligibilityCategory = { gender: null, minAge: null, maxAge: 17 };
    // Turns 18 today — no longer 17
    expect(isEligible(category, parseDateOnly('2008-08-06'), 'male', TODAY)).toBe(false);
    // Turns 18 tomorrow — still 17 today
    expect(isEligible(category, parseDateOnly('2008-08-07'), 'male', TODAY)).toBe(true);
  });

  it('defaults to the current date when today is omitted', () => {
    const category: EligibilityCategory = { gender: null, minAge: null, maxAge: null };
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'male')).toBe(true);
  });
});

describe('parseDateOnly', () => {
  it('parses year, month, and day as local-time midnight', () => {
    const date = parseDateOnly('2000-03-15');
    expect(date.getFullYear()).toBe(2000);
    expect(date.getMonth()).toBe(2); // 0-indexed
    expect(date.getDate()).toBe(15);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @crux/core exec vitest run src/eligibility.test.ts`
Expected: FAIL — `Cannot find module './eligibility'` (file doesn't exist yet).

- [ ] **Step 3: Implement `eligibility.ts`**

Create `packages/core/src/eligibility.ts`:

```ts
import type { Gender } from './index';

export interface EligibilityCategory {
  gender: Gender | null;
  minAge: number | null;
  maxAge: number | null;
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function ageInYears(birthDate: Date, today: Date): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function isEligible(
  category: EligibilityCategory,
  birthDate: Date,
  gender: Gender,
  today: Date = new Date(),
): boolean {
  const genderMatches =
    category.gender === null || category.gender === 'mixed' || category.gender === gender;
  if (!genderMatches) {
    return false;
  }

  const age = ageInYears(birthDate, today);
  if (category.minAge !== null && age < category.minAge) {
    return false;
  }
  if (category.maxAge !== null && age > category.maxAge) {
    return false;
  }
  return true;
}
```

- [ ] **Step 4: Export from the package entrypoint**

In `packages/core/src/index.ts`, add at the end of the file:

```ts
export { isEligible, parseDateOnly } from './eligibility';
export type { EligibilityCategory } from './eligibility';
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @crux/core exec vitest run src/eligibility.test.ts`
Expected: PASS — 9 tests passing.

- [ ] **Step 6: Run the full core suite and typecheck**

Run: `pnpm --filter @crux/core test && pnpm --filter @crux/core typecheck`
Expected: both PASS, including the pre-existing `index.test.ts` tests.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/eligibility.ts packages/core/src/eligibility.test.ts packages/core/src/index.ts
git commit -m "feat(core): add isEligible for category age/gender matching"
```

---

### Task 2: `registerAthlete` server action

**Files:**
- Create: `apps/web/app/(public)/inscripcion/[slug]/actions.ts`

**Interfaces:**
- Consumes: `isEligible`, `parseDateOnly`, `GENDERS` from `@crux/core` (Task 1).
- Consumes: `athletes`, `categories`, `registrations`, `eq` from `@crux/db`.
- Consumes: `getDb` from `@/lib/db`.
- Produces: `registerAthlete(input: RegisterAthleteInput): Promise<{ ok: true } | { ok: false; error: string }>`, where `RegisterAthleteInput = { eventId: string; categoryId: string; fullName: string; documentId: string; birthDate: string; gender: 'male' | 'female' | 'mixed' }` — consumed by Task 3's form.

- [ ] **Step 1: Write the server action**

Create `apps/web/app/(public)/inscripcion/[slug]/actions.ts`:

```ts
'use server';

import { z } from 'zod';
import { GENDERS, isEligible, parseDateOnly } from '@crux/core';
import { athletes, categories, eq, registrations } from '@crux/db';
import { getDb } from '@/lib/db';

type ActionResult = { ok: true } | { ok: false; error: string };

const registerInputSchema = z.object({
  eventId: z.string().uuid(),
  categoryId: z.string().uuid(),
  fullName: z.string().min(1),
  documentId: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(GENDERS),
});
type RegisterAthleteInput = z.infer<typeof registerInputSchema>;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export async function registerAthlete(input: RegisterAthleteInput): Promise<ActionResult> {
  const parsed = registerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de inscripción inválidos.' };
  }

  const db = getDb();
  const { eventId, categoryId, fullName, documentId, birthDate, gender } = parsed.data;

  const [category] = await db
    .select({
      id: categories.id,
      eventId: categories.eventId,
      gender: categories.gender,
      minAge: categories.minAge,
      maxAge: categories.maxAge,
    })
    .from(categories)
    .where(eq(categories.id, categoryId));
  if (!category || category.eventId !== eventId) {
    return { ok: false, error: 'Esa categoría no existe para este evento.' };
  }

  if (!isEligible(category, parseDateOnly(birthDate), gender)) {
    return { ok: false, error: 'Esa categoría no corresponde a tu edad o género.' };
  }

  const [existingAthlete] = await db
    .select({ id: athletes.id })
    .from(athletes)
    .where(eq(athletes.documentId, documentId));

  let athleteId: string;
  if (existingAthlete) {
    athleteId = existingAthlete.id;
  } else {
    const [newAthlete] = await db
      .insert(athletes)
      .values({ fullName, documentId, birthDate, gender })
      .returning({ id: athletes.id });
    if (!newAthlete) {
      throw new Error('Failed to create athlete');
    }
    athleteId = newAthlete.id;
  }

  try {
    await db.insert(registrations).values({ athleteId, eventId, categoryId });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'Ya estás inscrito en esta categoría.' };
    }
    throw error;
  }

  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crux/web typecheck`
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(public)/inscripcion/[slug]/actions.ts"
git commit -m "feat(web): add registerAthlete server action"
```

---

### Task 3: `RegistrationForm` client component

**Files:**
- Create: `apps/web/app/(public)/inscripcion/[slug]/registration-form.tsx`

**Interfaces:**
- Consumes: `registerAthlete` from `./actions` (Task 2).
- Consumes: `GENDERS`, `Gender`, `isEligible`, `parseDateOnly` from `@crux/core` (Task 1).
- Consumes: `fieldClass`, `primaryButtonClass` from `@/lib/ui`.
- Produces: `RegistrationForm({ eventId, categories }: { eventId: string; categories: { id: string; name: string; gender: Gender | null; minAge: number | null; maxAge: number | null }[] })` — consumed by Task 4's page.

- [ ] **Step 1: Write the component**

Create `apps/web/app/(public)/inscripcion/[slug]/registration-form.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { GENDERS, isEligible, parseDateOnly, type Gender } from '@crux/core';
import { registerAthlete } from './actions';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

type Category = {
  id: string;
  name: string;
  gender: Gender | null;
  minAge: number | null;
  maxAge: number | null;
};

function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

export function RegistrationForm({
  eventId,
  categories,
}: {
  eventId: string;
  categories: Category[];
}) {
  const [fullName, setFullName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eligibleCategories =
    birthDate && gender
      ? categories.filter((category) => isEligible(category, parseDateOnly(birthDate), gender))
      : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gender) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await registerAthlete({
      eventId,
      categoryId,
      fullName,
      documentId,
      birthDate,
      gender,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const category = categories.find((c) => c.id === categoryId);
    setSuccess(`Quedaste inscrito en ${category?.name ?? 'la categoría seleccionada'}.`);
  }

  if (success) {
    return (
      <p className="text-center font-display text-lg font-semibold text-pine">{success}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <input
        type="text"
        placeholder="Nombre completo"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        required
        className={fieldClass}
      />
      <input
        type="text"
        placeholder="Documento de identidad"
        value={documentId}
        onChange={(event) => setDocumentId(event.target.value)}
        required
        className={fieldClass}
      />
      <input
        type="date"
        value={birthDate}
        onChange={(event) => {
          setBirthDate(event.target.value);
          setCategoryId('');
        }}
        required
        className={fieldClass}
      />
      <select
        value={gender}
        onChange={(event) => {
          const value = event.target.value;
          if (value === '' || isGender(value)) {
            setGender(value);
            setCategoryId('');
          }
        }}
        required
        className={fieldClass}
      >
        <option value="">Género</option>
        <option value="male">Masculino</option>
        <option value="female">Femenino</option>
        <option value="mixed">Otro</option>
      </select>

      {birthDate && gender && eligibleCategories.length > 0 && (
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          required
          className={fieldClass}
        >
          <option value="">Elige tu categoría</option>
          {eligibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      )}
      {birthDate && gender && eligibleCategories.length === 0 && (
        <p className="text-sm text-muted">
          No hay categorías disponibles para tu edad y género en este evento.
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting || !categoryId} className={primaryButtonClass}>
        Inscribirme
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crux/web typecheck`
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(public)/inscripcion/[slug]/registration-form.tsx"
git commit -m "feat(web): add public registration form"
```

---

### Task 4: `/inscripcion/[slug]` page

**Files:**
- Create: `apps/web/app/(public)/inscripcion/[slug]/page.tsx`

**Interfaces:**
- Consumes: `RegistrationForm` from `./registration-form` (Task 3).
- Consumes: `categories`, `events`, `eq` from `@crux/db`.
- Consumes: `getDb` from `@/lib/db`.
- Consumes: `TopographicMotif` from `@/components/topographic-motif`.

- [ ] **Step 1: Write the page**

Create `apps/web/app/(public)/inscripcion/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { categories, eq, events } from '@crux/db';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { RegistrationForm } from './registration-form';

export default async function InscripcionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();

  const [event] = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.slug, slug));
  if (!event) {
    notFound();
  }

  const eventCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      gender: categories.gender,
      minAge: categories.minAge,
      maxAge: categories.maxAge,
    })
    .from(categories)
    .where(eq(categories.eventId, event.id))
    .orderBy(categories.name);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <h1 className="font-display text-3xl font-bold">{event.name}</h1>
      {eventCategories.length === 0 ? (
        <p className="max-w-md text-center text-sm text-muted">
          Inscripciones aún no disponibles para este evento.
        </p>
      ) : (
        <RegistrationForm eventId={event.id} categories={eventCategories} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crux/web typecheck`
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(public)/inscripcion/[slug]/page.tsx"
git commit -m "feat(web): add public /inscripcion/[slug] page"
```

---

### Task 5: End-to-end manual verification

No code changes — this is the "definición de terminado" check for the slice, run against a real dev DB. `apps/web` has no automated test runner (established deferral), so this is how the flow gets verified.

**Files:** none.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Expected: server up on `http://localhost:3000`.

- [ ] **Step 2: Ensure there's a test event with at least one age/gender-restricted category**

Sign in at `/sign-in`, go to `/panel`, create (or reuse) an event, note its `slug`, and add two categories: one `Femenino, 18-99` and one with no restrictions.

- [ ] **Step 3: Verify the empty-categories state**

Create a second event with zero categories, open `/inscripcion/<that-slug>`.
Expected: "Inscripciones aún no disponibles para este evento." — no form rendered.

- [ ] **Step 4: Verify the happy path**

Open `/inscripcion/<slug-with-categories>`. Fill name, a document id, a birth date/gender that qualifies for the unrestricted category. Submit.
Expected: confirmation message "Quedaste inscrito en …", no page crash.

- [ ] **Step 5: Verify age/gender filtering**

Reload the page. Enter a birth date that makes the athlete under 18. Confirm the `Femenino, 18-99` category is absent from the dropdown (only the unrestricted one shows).

- [ ] **Step 6: Verify duplicate rejection**

Reload the page. Submit again with the *same* document id and the *same* category used in Step 4.
Expected: inline error "Ya estás inscrito en esta categoría.", no new row.

- [ ] **Step 7: Verify athlete dedupe**

Register the same document id into the *other* eligible category (a different `categoryId`).
Expected: succeeds (different category, so the unique constraint doesn't block it). Open Drizzle Studio (`pnpm db:studio`) and confirm only **one** `athletes` row exists for that document id, with two `registrations` rows pointing at it.

- [ ] **Step 8: Verify unknown slug**

Open `/inscripcion/does-not-exist`.
Expected: Next.js 404 page.

- [ ] **Step 9: Final commit (if Step 2's seed data was created through the UI, no files changed — skip if nothing to commit)**

```bash
git status
```

If clean, nothing to do — the slice is done as of Task 4's commit.
