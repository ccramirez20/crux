# Stage 1 Domain Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder stubs in `packages/core/src/index.ts` and `packages/db/src/schema.ts` with the real stage 1 domain model — `Organization`, `Event`, `Category`, `Round`, `Problem`, `Athlete`, `Registration`, `Attempt` — per `docs/superpowers/specs/2026-08-05-domain-schema-design.md`.

**Architecture:** `packages/core` gets pure, IO-free TypeScript types (discipline/round-type/gender literal unions plus the `Attempt` shape) that `packages/scoring` will consume later. `packages/db` gets the matching Drizzle Postgres schema — 3 `pgEnum`s and 8 `pgTable`s — re-exported from its `index.ts` barrel. Corrections use the "implicit by recency" model from the spec: no `supersedesAttemptId` column: `attempts` is pure append-only and callers take the newest row per `(registrationId, problemId)`.

**Tech Stack:** TypeScript strict (existing `tsconfig.base.json`), Drizzle ORM 0.45.2 (`drizzle-orm/pg-core`), drizzle-kit 0.31.10, Vitest 4.1.x.

## Global Constraints

- Node 22, TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any`, no `as`) — from `tsconfig.base.json`.
- `packages/core` must not import `drizzle-orm`, `next`, or anything from `packages/db` — pure types only (`CLAUDE.md` dependency rules).
- `packages/db` contains persistence only, no business logic.
- Every table/enum name is `snake_case` in Postgres, `camelCase` in the Drizzle/TS definition — matches the existing `client.ts`/`schema.ts` style.
- No new external dependency except `vitest` added to `packages/core` (same version already used by `packages/db`, needed because `CLAUDE.md` requires tests in `packages/core`).
- Attempts are append-only: no `UPDATE`/`DELETE` semantics modeled, no edit path — corrections are new rows (`CLAUDE.md` decision #1).
- This plan does not touch `packages/scoring`, Better Auth, or any UI — those are separate slices per the spec's "Explicitly deferred" section.

---

### Task 1: `packages/core` — stage 1 domain types

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/index.test.ts`

**Interfaces:**
- Produces: `DISCIPLINES: readonly ['boulder', 'lead', 'speed']`, `Discipline` (union of `DISCIPLINES` elements), `ROUND_TYPES: readonly ['qualification', 'semifinal', 'final']`, `RoundType`, `GENDERS: readonly ['male', 'female', 'mixed']`, `Gender`, `ScoringFormat` (= `string`), `Attempt` interface — all exported from `@crux/core`. `packages/db` (Task 2) does **not** import these; it defines its own `pgEnum` values with the same literals, per the spec's "mirrored, not shared" design.

- [ ] **Step 1: Wire up testing for `packages/core`**

Replace `packages/core/package.json`:

```json
{
  "name": "@crux/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "lint": "echo 'sin lint todavia'",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Install the new devDependency**

Run: `pnpm install` (from repo root)
Expected: lockfile updates, no errors.

- [ ] **Step 3: Write the failing test**

Create `packages/core/src/index.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DISCIPLINES, ROUND_TYPES, GENDERS } from './index';
import type { Attempt } from './index';

describe('domain enums', () => {
  it('lists the three stage 1 disciplines', () => {
    expect(DISCIPLINES).toEqual(['boulder', 'lead', 'speed']);
  });

  it('lists the three round types', () => {
    expect(ROUND_TYPES).toEqual(['qualification', 'semifinal', 'final']);
  });

  it('lists the three gender categories', () => {
    expect(GENDERS).toEqual(['male', 'female', 'mixed']);
  });
});

describe('Attempt shape', () => {
  it('accepts a fully captured boulder attempt', () => {
    const attempt: Attempt = {
      id: '1',
      clientAttemptId: 'client-1',
      registrationId: 'reg-1',
      problemId: 'problem-1',
      judgeLabel: 'judge-phone-3',
      top: true,
      topAttempts: 2,
      zone: true,
      zoneAttempts: 1,
      height: null,
      capturedAt: new Date('2026-08-05T12:00:00Z'),
      createdAt: new Date('2026-08-05T12:00:01Z'),
    };

    expect(attempt.top).toBe(true);
  });

  it('accepts a lead attempt with no top/zone attempt counts', () => {
    const attempt: Attempt = {
      id: '2',
      clientAttemptId: 'client-2',
      registrationId: 'reg-2',
      problemId: 'problem-2',
      judgeLabel: 'judge-phone-1',
      top: false,
      topAttempts: null,
      zone: false,
      zoneAttempts: null,
      height: 12.5,
      capturedAt: new Date('2026-08-05T12:05:00Z'),
      createdAt: new Date('2026-08-05T12:05:01Z'),
    };

    expect(attempt.height).toBe(12.5);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @crux/core test`
Expected: FAIL — `./index` has no exported member `DISCIPLINES` (module resolves but the named exports don't exist yet, since `index.ts` is still `export {};`).

- [ ] **Step 5: Implement the domain types**

Replace `packages/core/src/index.ts`:

```typescript
export const DISCIPLINES = ['boulder', 'lead', 'speed'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const ROUND_TYPES = ['qualification', 'semifinal', 'final'] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

export const GENDERS = ['male', 'female', 'mixed'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Identifier for a packages/scoring strategy. The registry of valid values
 * (and the score() function that reads them) lives in packages/scoring, not
 * here — core stays IO- and logic-free.
 */
export type ScoringFormat = string;

export interface Attempt {
  id: string;
  clientAttemptId: string;
  registrationId: string;
  problemId: string;
  judgeLabel: string;
  top: boolean;
  topAttempts: number | null;
  zone: boolean;
  zoneAttempts: number | null;
  height: number | null;
  capturedAt: Date;
  createdAt: Date;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @crux/core test`
Expected: PASS — 5 tests.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @crux/core typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/core/package.json packages/core/src/index.ts packages/core/src/index.test.ts pnpm-lock.yaml
git commit -m "feat(core): add stage 1 domain types"
```

---

### Task 2: `packages/db` — stage 1 Drizzle schema

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/schema.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (schema literals are independently defined, see Task 1's Interfaces note).
- Produces: `disciplineEnum`, `roundTypeEnum`, `genderEnum` (Drizzle `pgEnum`s) and `organizations`, `events`, `categories`, `rounds`, `problems`, `athletes`, `registrations`, `attempts` (Drizzle `pgTable`s), all exported from `./schema` and re-exported from `@crux/db`. Task 3 (migration generation) consumes this file directly via `drizzle.config.ts`'s `schema: './src/schema.ts'`.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  disciplineEnum,
  roundTypeEnum,
  genderEnum,
  events,
  categories,
  registrations,
  attempts,
  problems,
  athletes,
} from './schema';

describe('enums', () => {
  it('discipline has the three stage 1 disciplines', () => {
    expect(disciplineEnum.enumValues).toEqual(['boulder', 'lead', 'speed']);
  });

  it('roundType has qualification, semifinal, final', () => {
    expect(roundTypeEnum.enumValues).toEqual([
      'qualification',
      'semifinal',
      'final',
    ]);
  });

  it('gender has male, female, mixed', () => {
    expect(genderEnum.enumValues).toEqual(['male', 'female', 'mixed']);
  });
});

describe('events', () => {
  it('requires organizationId and enforces a unique slug', () => {
    expect(events.organizationId.notNull).toBe(true);
    expect(events.slug.notNull).toBe(true);
    expect(events.slug.isUnique).toBe(true);
  });
});

describe('categories', () => {
  it('makes gender, age range and level optional', () => {
    expect(categories.gender.notNull).toBe(false);
    expect(categories.minAge.notNull).toBe(false);
    expect(categories.maxAge.notNull).toBe(false);
    expect(categories.level.notNull).toBe(false);
  });
});

describe('registrations', () => {
  it('stores both eventId and categoryId', () => {
    expect(registrations.eventId.notNull).toBe(true);
    expect(registrations.categoryId.notNull).toBe(true);
  });
});

describe('attempts', () => {
  it('has a unique, required clientAttemptId for idempotent capture', () => {
    expect(attempts.clientAttemptId.notNull).toBe(true);
    expect(attempts.clientAttemptId.isUnique).toBe(true);
  });

  it('requires top and zone but leaves attempt counts and height optional', () => {
    expect(attempts.top.notNull).toBe(true);
    expect(attempts.zone.notNull).toBe(true);
    expect(attempts.topAttempts.notNull).toBe(false);
    expect(attempts.zoneAttempts.notNull).toBe(false);
    expect(attempts.height.notNull).toBe(false);
  });
});

describe('column naming', () => {
  it('uses snake_case column names in Postgres', () => {
    expect(problems.roundId.name).toBe('round_id');
    expect(athletes.fullName.name).toBe('full_name');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @crux/db test`
Expected: FAIL — `./schema` has no exported member `disciplineEnum` (schema.ts is still `export {};`).

- [ ] **Step 3: Implement the schema**

Replace `packages/db/src/schema.ts`:

```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';

export const disciplineEnum = pgEnum('discipline', ['boulder', 'lead', 'speed']);
export const roundTypeEnum = pgEnum('round_type', [
  'qualification',
  'semifinal',
  'final',
]);
export const genderEnum = pgEnum('gender', ['male', 'female', 'mixed']);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  discipline: disciplineEnum('discipline').notNull(),
  scoringFormat: text('scoring_format').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id),
  name: text('name').notNull(),
  gender: genderEnum('gender'),
  minAge: integer('min_age'),
  maxAge: integer('max_age'),
  level: text('level'),
});

export const rounds = pgTable('rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  type: roundTypeEnum('type').notNull(),
  order: integer('order').notNull(),
});

export const problems = pgTable('problems', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id')
    .notNull()
    .references(() => rounds.id),
  number: integer('number').notNull(),
  name: text('name'),
});

export const athletes = pgTable('athletes', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  documentId: text('document_id'),
  birthDate: date('birth_date'),
  gender: genderEnum('gender'),
});

export const registrations = pgTable('registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  bibNumber: text('bib_number'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAttemptId: uuid('client_attempt_id').notNull().unique(),
  registrationId: uuid('registration_id')
    .notNull()
    .references(() => registrations.id),
  problemId: uuid('problem_id')
    .notNull()
    .references(() => problems.id),
  judgeLabel: text('judge_label').notNull(),
  top: boolean('top').notNull(),
  topAttempts: integer('top_attempts'),
  zone: boolean('zone').notNull(),
  zoneAttempts: integer('zone_attempts'),
  height: numeric('height', { mode: 'number' }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @crux/db test`
Expected: PASS — all `schema.test.ts` cases plus the existing `client.test.ts` cases (9 total).

- [ ] **Step 5: Re-export the schema from the package barrel**

Modify `packages/db/src/index.ts` — add one line:

```typescript
export { createDb } from './client';
export type { Db } from './client';
export { sql } from 'drizzle-orm';
export * from './schema';
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @crux/db typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/schema.test.ts packages/db/src/index.ts
git commit -m "feat(db): add stage 1 domain schema"
```

---

### Task 3: Generate and commit the initial migration

**Files:**
- Create: `packages/db/drizzle/0000_<generated_name>.sql` (name chosen by drizzle-kit, not authored)
- Create: `packages/db/drizzle/meta/_journal.json` and `packages/db/drizzle/meta/0000_snapshot.json` (drizzle-kit bookkeeping)

**Interfaces:**
- Consumes: `packages/db/src/schema.ts` from Task 2, via `packages/db/drizzle.config.ts` (already exists, unchanged).
- Produces: the first committed migration, so `pnpm db:migrate` has something to apply against a real Postgres instance. Nothing later in this plan consumes it directly — verification is manual inspection, not automated.

`drizzle-kit generate` only reads the local `schema.ts` and diffs it against `packages/db/drizzle/meta/` — it does not need `DATABASE_URL` or a live connection.

- [ ] **Step 1: Generate the migration**

Run: `pnpm db:generate` (from repo root)
Expected: output ending in a line like `Your SQL migration file ➜ packages/db/drizzle/0000_<name>.sql 🚀`, and a new `packages/db/drizzle/` directory containing that `.sql` file plus a `meta/` folder.

- [ ] **Step 2: Verify the generated SQL covers all 8 tables**

Open the generated `packages/db/drizzle/0000_*.sql` file and confirm it contains a `CREATE TABLE` statement for each of: `organizations`, `events`, `categories`, `rounds`, `problems`, `athletes`, `registrations`, `attempts`, plus `CREATE TYPE` statements for `discipline`, `round_type`, `gender`.

If any table or enum is missing, the schema in Task 2 has a typo or a table wasn't exported — fix `schema.ts` and re-run Step 1 (delete the partial `drizzle/` output first).

- [ ] **Step 3: Commit**

```bash
git add packages/db/drizzle
git commit -m "chore(db): generate initial migration for stage 1 schema"
```

---

## Definition of Done for This Plan

- `pnpm --filter @crux/core test` and `pnpm --filter @crux/db test` both pass.
- `pnpm typecheck` (root, all packages) passes.
- `packages/db/drizzle/0000_*.sql` exists and creates all 8 stage 1 tables plus 3 enums.
- `packages/core/src/index.ts` and `packages/db/src/schema.ts` no longer contain the placeholder `export {};`.
