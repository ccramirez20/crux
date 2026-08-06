# Scoring: ifsc_boulder, league_points, max_height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3 remaining `notImplemented` stubs in `packages/scoring`'s registry (`ifsc_boulder`, `league_points`, `max_height`) with real ranking algorithms, so all 4 `scoringFormat` values the app already offers actually compute a leaderboard.

**Architecture:** Extract the two pieces of logic every strategy needs (current-attempt resolution by `sequence`; standard-competition rank/tie assignment) out of `classic-tops-zones.ts` into shared modules, then implement each new strategy as its own file following the same shape: aggregate per registration, sort with a comparator, assign ranks via the shared helper. `league_points` additionally needs organizer-configured point values per problem, which requires a small schema change (`problems.topPoints`/`zonePoints`) and a form field.

**Tech Stack:** TypeScript strict, Vitest, Drizzle (`@crux/db`), Next.js Server Actions (`apps/web`).

## Global Constraints

- No `any`. No `as` to silence the compiler. (CLAUDE.md)
- `packages/core` and `packages/scoring` import nothing from `db`, `next`, or network. (CLAUDE.md)
- Errors: `Result<T, E>` in domain code. All 4 registry entries return `ok(...)` once this plan ships — there is no remaining error path in `packages/scoring`, but `ScoringError`/`err` stay defined for a future 5th format. (CLAUDE.md, spec)
- Every scoring strategy needs tests against real tie-break scenarios. (CLAUDE.md, domain decision #2)
- The current attempt per `(registrationId, problemId)` is the row with the highest `sequence` — this resolution is shared logic now (`resolve-attempts.ts`), not reimplemented per strategy.
- Standard competition ranking (ties share a rank; the next rank skips ahead by the tie group's size) is shared logic now (`rank-assignment.ts`), not reimplemented per strategy.
- `ifsc_boulder`: top = 25.0 points, zone = 10.0 points, each additional attempt after the first costs 0.1 point off that component, floored at 0. Top and zone points are **additive** (a first-try top scores 35.0). All arithmetic happens in integer tenths internally; convert to points (`/10`) only in the final result.
- `ifsc_boulder`/`classic_tops_zones` share the "topping implies zone" rule (`zone: true` OR `top: true` counts as zoned). `league_points` does **not** use this rule — its zone credit only applies when `attempt.zone === true` and `top` is false.
- `league_points`: topped → `topPoints`; not topped but zoned and `zonePoints` is a number (not `null`/missing) → `zonePoints`; otherwise 0. Never both. `zonePoints: null` (or the problem missing from `problemPoints`) means no partial credit for that block — this is the per-block toggle; there is no separate boolean column.
- All 4 formats: a registration with zero attempts (DNS) scores the bottom of its scale (0 tops/points/height) and ranks last. All 4 formats: an exact tie shares one rank; there is no format-specific secondary tiebreak beyond what's stated above.
- Migrations: never edit an applied one, always a new one. (CLAUDE.md)
- Money/points are plain integers here (not currency) — no decimal-cents handling needed for `topPoints`/`zonePoints`.
- Out of scope: wiring `scoreRound()` into any `apps/web` route; validating that an organizer set `topPoints` before publishing a `league_points` event (missing values silently score 0); a 5th format (speed).

---

### Task 1: Extract shared `resolveCurrentAttempts` and `assignRanks`

**Files:**
- Create: `packages/scoring/src/resolve-attempts.ts`
- Create: `packages/scoring/src/resolve-attempts.test.ts`
- Create: `packages/scoring/src/rank-assignment.ts`
- Create: `packages/scoring/src/rank-assignment.test.ts`
- Create: `packages/scoring/src/test-support.ts`
- Modify: `packages/scoring/src/classic-tops-zones.ts`
- Modify: `packages/scoring/src/classic-tops-zones.test.ts`

**Interfaces:**
- Produces: `resolveCurrentAttempts(attempts: Attempt[], problemIds: Set<string>): Attempt[]`
- Produces: `interface RankedItem { rank: number; tied: boolean }`
- Produces: `assignRanks<T>(sorted: T[], isTiedWithPrevious: (current: T, previous: T) => boolean): RankedItem[]`
- Produces: `makeAttempt(overrides: Partial<Attempt> & Pick<Attempt, 'registrationId' | 'problemId' | 'sequence'>): Attempt` (test-only helper)
- Consumes (by later tasks): all three of the above, imported by every new strategy file and its test file.

This task is a pure extraction — `scoreClassicTopsZones`'s behavior must not change. Its existing 11 tests are the regression check.

- [ ] **Step 1: Write the failing tests for the two new shared modules**

Create `packages/scoring/src/resolve-attempts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveCurrentAttempts } from './resolve-attempts';
import { makeAttempt } from './test-support';

describe('resolveCurrentAttempts', () => {
  it('keeps only the highest-sequence row per (registrationId, problemId)', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: false }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 2, top: true, topAttempts: 3 }),
    ];

    const result = resolveCurrentAttempts(attempts, new Set(['p1']));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sequence: 2, top: true, topAttempts: 3 });
  });

  it('drops attempts for problems outside the given set', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'other-round', sequence: 2, top: true }),
    ];

    const result = resolveCurrentAttempts(attempts, new Set(['p1']));

    expect(result).toHaveLength(1);
    expect(result[0]?.problemId).toBe('p1');
  });
});
```

Create `packages/scoring/src/rank-assignment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assignRanks } from './rank-assignment';

describe('assignRanks', () => {
  it('ranks a fully distinct sorted list 1, 2, 3', () => {
    const sorted = [10, 8, 5];
    const result = assignRanks(sorted, (a, b) => a === b);
    expect(result).toEqual([
      { rank: 1, tied: false },
      { rank: 2, tied: false },
      { rank: 3, tied: false },
    ]);
  });

  it('gives a 2-member tie the same rank and skips the next rank by the group size', () => {
    const sorted = [10, 10, 5];
    const result = assignRanks(sorted, (a, b) => a === b);
    expect(result).toEqual([
      { rank: 1, tied: true },
      { rank: 1, tied: true },
      { rank: 3, tied: false },
    ]);
  });

  it('gives a 3-member tie the same rank and skips the next rank by the group size', () => {
    const sorted = [10, 10, 10, 5];
    const result = assignRanks(sorted, (a, b) => a === b);
    expect(result).toEqual([
      { rank: 1, tied: true },
      { rank: 1, tied: true },
      { rank: 1, tied: true },
      { rank: 4, tied: false },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @crux/scoring exec vitest run src/resolve-attempts.test.ts src/rank-assignment.test.ts`
Expected: FAIL — `Cannot find module './resolve-attempts'`, `Cannot find module './rank-assignment'`, `Cannot find module './test-support'`

- [ ] **Step 3: Create the test support helper**

Create `packages/scoring/src/test-support.ts` (copied verbatim from the top of the existing `classic-tops-zones.test.ts`, made reusable):

```ts
import type { Attempt } from '@crux/core';

let attemptCounter = 0;

export function makeAttempt(
  overrides: Partial<Attempt> & Pick<Attempt, 'registrationId' | 'problemId' | 'sequence'>,
): Attempt {
  attemptCounter += 1;
  return {
    id: `attempt-${attemptCounter}`,
    clientAttemptId: `client-${attemptCounter}`,
    judgeLabel: 'judge-1',
    top: false,
    topAttempts: null,
    zone: false,
    zoneAttempts: null,
    height: null,
    capturedAt: new Date('2026-08-06T12:00:00Z'),
    createdAt: new Date('2026-08-06T12:00:00Z'),
    ...overrides,
  };
}
```

- [ ] **Step 4: Implement `resolveCurrentAttempts`**

Create `packages/scoring/src/resolve-attempts.ts` (moved verbatim from `classic-tops-zones.ts`):

```ts
import type { Attempt } from '@crux/core';

export function resolveCurrentAttempts(attempts: Attempt[], problemIds: Set<string>): Attempt[] {
  const currentByKey = new Map<string, Attempt>();
  for (const attempt of attempts) {
    if (!problemIds.has(attempt.problemId)) continue;
    const key = `${attempt.registrationId}:${attempt.problemId}`;
    const existing = currentByKey.get(key);
    if (!existing || attempt.sequence > existing.sequence) {
      currentByKey.set(key, attempt);
    }
  }
  return [...currentByKey.values()];
}
```

- [ ] **Step 5: Implement `assignRanks`**

Create `packages/scoring/src/rank-assignment.ts`:

```ts
export interface RankedItem {
  rank: number;
  tied: boolean;
}

export function assignRanks<T>(
  sorted: T[],
  isTiedWithPrevious: (current: T, previous: T) => boolean,
): RankedItem[] {
  const ranks: number[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const tiedWithPrevious = index > 0 && isTiedWithPrevious(sorted[index]!, sorted[index - 1]!);
    ranks.push(tiedWithPrevious ? ranks[index - 1]! : index + 1);
  }

  return ranks.map((rank, index) => {
    const sharesRankWithPrevious = index > 0 && rank === ranks[index - 1];
    const sharesRankWithNext = index < ranks.length - 1 && rank === ranks[index + 1];
    return { rank, tied: sharesRankWithPrevious || sharesRankWithNext };
  });
}
```

- [ ] **Step 6: Run the new tests to verify they pass**

Run: `pnpm --filter @crux/scoring exec vitest run src/resolve-attempts.test.ts src/rank-assignment.test.ts`
Expected: PASS (5 tests: 2 in resolve-attempts, 3 in rank-assignment)

- [ ] **Step 7: Refactor `classic-tops-zones.ts` to use the shared modules**

Replace the full contents of `packages/scoring/src/classic-tops-zones.ts` with:

```ts
import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { ClassicTopsZonesResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  tops: number;
  topAttempts: number;
  zones: number;
  zoneAttempts: number;
}

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const forRegistration = currentAttempts.filter((a) => a.registrationId === registrationId);
  let tops = 0;
  let topAttempts = 0;
  let zones = 0;
  let zoneAttempts = 0;
  for (const attempt of forRegistration) {
    if (attempt.top) {
      tops += 1;
      topAttempts += attempt.topAttempts ?? 1;
    }
    // Topping a problem necessarily passes the zone hold on the way, so it
    // always counts toward zones too, even if the judge row didn't also set
    // `zone: true`.
    if (attempt.zone || attempt.top) {
      zones += 1;
      zoneAttempts += attempt.zoneAttempts ?? attempt.topAttempts ?? 1;
    }
  }
  return { registrationId, tops, topAttempts, zones, zoneAttempts };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  if (a.tops !== b.tops) return b.tops - a.tops;
  if (a.topAttempts !== b.topAttempts) return a.topAttempts - b.topAttempts;
  if (a.zones !== b.zones) return b.zones - a.zones;
  return a.zoneAttempts - b.zoneAttempts;
}

export function scoreClassicTopsZones(
  attempts: Attempt[],
  config: RoundScoringConfig,
): ClassicTopsZonesResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'classic_tops_zones',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    tops: current.tops,
    topAttempts: current.topAttempts,
    zones: current.zones,
    zoneAttempts: current.zoneAttempts,
  }));
}
```

- [ ] **Step 8: Update `classic-tops-zones.test.ts` to import the shared test helper**

In `packages/scoring/src/classic-tops-zones.test.ts`, replace the top of the file (the `let attemptCounter` line through the closing `}` of `makeAttempt`) with a single import, leaving every `describe`/`it` block below it untouched:

```ts
import { describe, expect, it } from 'vitest';
import { scoreClassicTopsZones } from './classic-tops-zones';
import { makeAttempt } from './test-support';
```

(Remove the old `import type { Attempt } from '@crux/core';` and the local `makeAttempt` definition — the new import replaces both. Do not change any `describe`/`it` block bodies or assertions.)

- [ ] **Step 9: Run the full scoring suite to verify no regressions**

Run: `pnpm --filter @crux/scoring test`
Expected: PASS — all tests pass, including `classic-tops-zones.test.ts`'s original 11 tests with **identical** pass/fail behavior to before this refactor (same test names, same assertions, same results).

- [ ] **Step 10: Typecheck**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add packages/scoring/src/resolve-attempts.ts packages/scoring/src/resolve-attempts.test.ts packages/scoring/src/rank-assignment.ts packages/scoring/src/rank-assignment.test.ts packages/scoring/src/test-support.ts packages/scoring/src/classic-tops-zones.ts packages/scoring/src/classic-tops-zones.test.ts
git commit -m "refactor(scoring): extract resolveCurrentAttempts and assignRanks into shared modules"
```

---

### Task 2: `ifsc_boulder` strategy

**Files:**
- Modify: `packages/scoring/src/types.ts`
- Create: `packages/scoring/src/ifsc-boulder.ts`
- Create: `packages/scoring/src/ifsc-boulder.test.ts`

**Interfaces:**
- Consumes: `resolveCurrentAttempts` (Task 1), `assignRanks` (Task 1), `makeAttempt` (Task 1, test-only), `Attempt` from `@crux/core`.
- Produces: `interface IfscBoulderResult { format: 'ifsc_boulder'; rank: number; tied: boolean; registrationId: string; score: number }`
- Produces: `scoreIfscBoulder(attempts: Attempt[], config: RoundScoringConfig): IfscBoulderResult[]`

- [ ] **Step 1: Add `IfscBoulderResult` to the shared types and widen `RankedResult`**

In `packages/scoring/src/types.ts`, add after `ClassicTopsZonesResult`:

```ts
export interface IfscBoulderResult {
  format: 'ifsc_boulder';
  rank: number;
  tied: boolean;
  registrationId: string;
  score: number;
}
```

Change:

```ts
// Union of one today; each shipped strategy adds its own variant here.
export type RankedResult = ClassicTopsZonesResult;
```

to:

```ts
export type RankedResult = ClassicTopsZonesResult | IfscBoulderResult;
```

- [ ] **Step 2: Write the failing tests**

Create `packages/scoring/src/ifsc-boulder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scoreIfscBoulder } from './ifsc-boulder';
import { makeAttempt } from './test-support';

describe('scoreIfscBoulder', () => {
  it('scores a first-attempt top as 35 (25 top + 10 zone), additive', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result[0]).toMatchObject({ registrationId: 'reg-a', score: 35 });
  });

  it('deducts 0.1 per extra attempt from the top score, independent of the zone score', () => {
    const attempts = [
      makeAttempt({
        registrationId: 'reg-a', problemId: 'p1', sequence: 1,
        top: true, topAttempts: 3, zone: true, zoneAttempts: 1,
      }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // top: 25 - 0.2 = 24.8; zone: 10 - 0 = 10; total 34.8
    expect(result[0]).toMatchObject({ score: 34.8 });
  });

  it('scores zone-only (no top) using just the zone formula', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true, zoneAttempts: 2 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // zone: 10 - 0.1 = 9.9; no top score
    expect(result[0]).toMatchObject({ score: 9.9 });
  });

  it('scores neither top nor zone as 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('floors a component at 0 when attempts are high enough to exceed its value', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 300 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // top floored at 0 (300 attempts far exceeds 25/0.1=250 break-even); zone credited via top-implies-zone at topAttempts fallback, also floored at 0
    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('sums scores across multiple problems for one registration', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, zone: true, zoneAttempts: 1 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a'] };

    const result = scoreIfscBoulder(attempts, config);

    // p1: 35 (top+zone), p2: 10 (zone only) = 45
    expect(result[0]).toMatchObject({ score: 45 });
  });

  it('gives a real tie the same rank', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('ranks a registration with zero attempts last, scoring 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-dns'] };

    const result = scoreIfscBoulder(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ score: 0 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @crux/scoring exec vitest run src/ifsc-boulder.test.ts`
Expected: FAIL — `Cannot find module './ifsc-boulder'`

- [ ] **Step 4: Implement `scoreIfscBoulder`**

Create `packages/scoring/src/ifsc-boulder.ts`:

```ts
import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { IfscBoulderResult, RoundScoringConfig } from './types';

const TOP_VALUE_TENTHS = 250; // 25.0 points
const ZONE_VALUE_TENTHS = 100; // 10.0 points
const DEDUCTION_PER_ATTEMPT_TENTHS = 1; // 0.1 points

interface Aggregate {
  registrationId: string;
  scoreTenths: number;
}

function problemScoreTenths(attempt: Attempt): number {
  let scoreTenths = 0;
  if (attempt.top) {
    const topAttemptsUsed = attempt.topAttempts ?? 1;
    scoreTenths += Math.max(0, TOP_VALUE_TENTHS - (topAttemptsUsed - 1) * DEDUCTION_PER_ATTEMPT_TENTHS);
  }
  // Topping a problem necessarily passes the zone hold on the way, so it
  // always counts toward the zone score too, same rule as classic_tops_zones.
  if (attempt.zone || attempt.top) {
    const zoneAttemptsUsed = attempt.zoneAttempts ?? attempt.topAttempts ?? 1;
    scoreTenths += Math.max(0, ZONE_VALUE_TENTHS - (zoneAttemptsUsed - 1) * DEDUCTION_PER_ATTEMPT_TENTHS);
  }
  return scoreTenths;
}

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const scoreTenths = currentAttempts
    .filter((a) => a.registrationId === registrationId)
    .reduce((total, attempt) => total + problemScoreTenths(attempt), 0);
  return { registrationId, scoreTenths };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  return b.scoreTenths - a.scoreTenths;
}

export function scoreIfscBoulder(
  attempts: Attempt[],
  config: RoundScoringConfig,
): IfscBoulderResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'ifsc_boulder',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    score: current.scoreTenths / 10,
  }));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @crux/scoring exec vitest run src/ifsc-boulder.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/scoring/src/types.ts packages/scoring/src/ifsc-boulder.ts packages/scoring/src/ifsc-boulder.test.ts
git commit -m "feat(scoring): implement ifsc_boulder ranking"
```

---

### Task 3: `league_points` strategy (algorithm only, no DB/UI yet)

**Files:**
- Modify: `packages/scoring/src/types.ts`
- Create: `packages/scoring/src/league-points.ts`
- Create: `packages/scoring/src/league-points.test.ts`

**Interfaces:**
- Consumes: `resolveCurrentAttempts`, `assignRanks`, `makeAttempt` (Task 1), `Attempt` from `@crux/core`.
- Produces: `interface LeaguePointsResult { format: 'league_points'; rank: number; tied: boolean; registrationId: string; score: number }`
- Produces: `RoundScoringConfig.problemPoints?: Record<string, { topPoints: number; zonePoints: number | null }>`
- Produces: `scoreLeaguePoints(attempts: Attempt[], config: RoundScoringConfig): LeaguePointsResult[]`

- [ ] **Step 1: Add `problemPoints` to `RoundScoringConfig`, add `LeaguePointsResult`, widen `RankedResult`**

In `packages/scoring/src/types.ts`, change:

```ts
export interface RoundScoringConfig {
  problemIds: string[];
  registrationIds: string[];
}
```

to:

```ts
export interface RoundScoringConfig {
  problemIds: string[];
  registrationIds: string[];
  problemPoints?: Record<string, { topPoints: number; zonePoints: number | null }>;
}
```

Add after `IfscBoulderResult`:

```ts
export interface LeaguePointsResult {
  format: 'league_points';
  rank: number;
  tied: boolean;
  registrationId: string;
  score: number;
}
```

Change:

```ts
export type RankedResult = ClassicTopsZonesResult | IfscBoulderResult;
```

to:

```ts
export type RankedResult = ClassicTopsZonesResult | IfscBoulderResult | LeaguePointsResult;
```

- [ ] **Step 2: Write the failing tests**

Create `packages/scoring/src/league-points.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scoreLeaguePoints } from './league-points';
import { makeAttempt } from './test-support';

describe('scoreLeaguePoints', () => {
  it('scores a topped problem using its configured topPoints', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 500 });
  });

  it('scores a zoned-not-topped problem using zonePoints when set', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: 100 } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 100 });
  });

  it('scores a zoned-not-topped problem as 0 when zonePoints is null (toggle off)', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('does not additionally award zonePoints when the problem was topped (not additive)', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a'],
      problemPoints: { p1: { topPoints: 500, zonePoints: 100 } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 500 });
  });

  it('scores a problem missing from problemPoints as 0 regardless of top/zone', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'], problemPoints: {} };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 0 });
  });

  it('sums scores across multiple problems', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, zone: true }),
    ];
    const config = {
      problemIds: ['p1', 'p2'],
      registrationIds: ['reg-a'],
      problemPoints: {
        p1: { topPoints: 500, zonePoints: null },
        p2: { topPoints: 300, zonePoints: 50 },
      },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result[0]).toMatchObject({ score: 550 });
  });

  it('gives a real tie the same rank', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a', 'reg-b'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('ranks a registration with zero attempts last, scoring 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true }),
    ];
    const config = {
      problemIds: ['p1'],
      registrationIds: ['reg-a', 'reg-dns'],
      problemPoints: { p1: { topPoints: 500, zonePoints: null } },
    };

    const result = scoreLeaguePoints(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ score: 0 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @crux/scoring exec vitest run src/league-points.test.ts`
Expected: FAIL — `Cannot find module './league-points'`

- [ ] **Step 4: Implement `scoreLeaguePoints`**

Create `packages/scoring/src/league-points.ts`:

```ts
import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { LeaguePointsResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  score: number;
}

function problemScore(
  attempt: Attempt,
  points: { topPoints: number; zonePoints: number | null } | undefined,
): number {
  if (attempt.top) {
    return points?.topPoints ?? 0;
  }
  if (attempt.zone && points?.zonePoints != null) {
    return points.zonePoints;
  }
  return 0;
}

function aggregate(
  registrationId: string,
  currentAttempts: Attempt[],
  problemPoints: RoundScoringConfig['problemPoints'],
): Aggregate {
  const score = currentAttempts
    .filter((a) => a.registrationId === registrationId)
    .reduce((total, attempt) => total + problemScore(attempt, problemPoints?.[attempt.problemId]), 0);
  return { registrationId, score };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  return b.score - a.score;
}

export function scoreLeaguePoints(
  attempts: Attempt[],
  config: RoundScoringConfig,
): LeaguePointsResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts, config.problemPoints))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'league_points',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    score: current.score,
  }));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @crux/scoring exec vitest run src/league-points.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/scoring/src/types.ts packages/scoring/src/league-points.ts packages/scoring/src/league-points.test.ts
git commit -m "feat(scoring): implement league_points ranking"
```

---

### Task 4: `problems.topPoints`/`zonePoints` schema change + problem form field

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/schema.test.ts`
- Create: (generated) `packages/db/drizzle/0003_*.sql` (via `pnpm db:generate`, exact filename chosen by drizzle-kit)
- Modify: `apps/web/app/(organizer)/panel/events/[id]/problem-form.tsx`
- Modify: `apps/web/app/(organizer)/panel/events/[id]/event-structure.tsx`
- Modify: `apps/web/app/(organizer)/panel/events/[id]/page.tsx`
- Modify: `apps/web/app/(organizer)/panel/events/[id]/actions.ts`

**Interfaces:**
- Produces: `problems.topPoints: integer, nullable`, `problems.zonePoints: integer, nullable` (DB columns).
- Produces: `ProblemForm` gains a new required prop `scoringFormat: string`.
- Consumes: none from earlier tasks (this task is independent of Tasks 1-3; it doesn't touch `packages/scoring` at all — the pure algorithm from Task 3 already accepts points via its `config` parameter, so this task is purely "let an organizer actually set those values").

- [ ] **Step 1: Add the columns to the schema**

In `packages/db/src/schema.ts`, change the `problems` table definition from:

```ts
export const problems = pgTable('problems', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id')
    .notNull()
    .references(() => rounds.id),
  number: integer('number').notNull(),
  name: text('name'),
});
```

to:

```ts
export const problems = pgTable('problems', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id')
    .notNull()
    .references(() => rounds.id),
  number: integer('number').notNull(),
  name: text('name'),
  // Only meaningful for league_points events; every other format leaves
  // these null. zonePoints: null is the per-block "no partial credit for
  // zoning" toggle — there is no separate boolean column for it.
  topPoints: integer('top_points'),
  zonePoints: integer('zone_points'),
});
```

- [ ] **Step 2: Add schema tests for the new columns**

In `packages/db/src/schema.test.ts`, add a new `describe` block after the `attempts` block:

```ts
describe('problems', () => {
  it('leaves topPoints and zonePoints optional (only league_points events set them)', () => {
    expect(problems.topPoints.notNull).toBe(false);
    expect(problems.zonePoints.notNull).toBe(false);
  });
});
```

- [ ] **Step 3: Run the schema test to verify it fails**

Run: `pnpm --filter @crux/db exec vitest run src/schema.test.ts`
Expected: FAIL — `problems.topPoints` is `undefined`

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file appears under `packages/db/drizzle/` (e.g. `0003_<generated-name>.sql`) containing `ALTER TABLE "problems" ADD COLUMN "top_points" integer;` and the equivalent for `zone_points`. Do not hand-edit the generated SQL.

- [ ] **Step 5: Run the schema test to verify it passes**

Run: `pnpm --filter @crux/db exec vitest run src/schema.test.ts`
Expected: PASS (14 tests — 13 existing + 1 new)

- [ ] **Step 6: Typecheck the db package**

Run: `pnpm --filter @crux/db exec tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Pass the event's scoringFormat down to ProblemForm**

In `apps/web/app/(organizer)/panel/events/[id]/page.tsx`, change the event query from:

```ts
  const [event] = await db
    .select({ id: events.id, name: events.name, ownerId: events.ownerId })
    .from(events)
    .where(eq(events.id, eventId));
```

to:

```ts
  const [event] = await db
    .select({ id: events.id, name: events.name, ownerId: events.ownerId, scoringFormat: events.scoringFormat })
    .from(events)
    .where(eq(events.id, eventId));
```

and change the `<EventStructure ... />` call from:

```tsx
      <EventStructure
        eventId={event.id}
        categories={structuredCategories}
        isOwner={event.ownerId === session.user.id}
      />
```

to:

```tsx
      <EventStructure
        eventId={event.id}
        categories={structuredCategories}
        isOwner={event.ownerId === session.user.id}
        scoringFormat={event.scoringFormat}
      />
```

- [ ] **Step 8: Thread scoringFormat through EventStructure to ProblemForm**

In `apps/web/app/(organizer)/panel/events/[id]/event-structure.tsx`, change the props signature from:

```ts
export function EventStructure({
  eventId,
  categories,
  isOwner,
}: {
  eventId: string;
  categories: Category[];
  isOwner: boolean;
}) {
```

to:

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

and change the `<ProblemForm ... />` call from:

```tsx
                          {isOwner && <ProblemForm eventId={eventId} roundId={round.id} nextNumber={round.problems.length + 1} />}
```

to:

```tsx
                          {isOwner && (
                            <ProblemForm
                              eventId={eventId}
                              roundId={round.id}
                              nextNumber={round.problems.length + 1}
                              scoringFormat={scoringFormat}
                            />
                          )}
```

- [ ] **Step 9: Add the points fields to ProblemForm, shown only for league_points**

Replace the full contents of `apps/web/app/(organizer)/panel/events/[id]/problem-form.tsx` with:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { createProblem } from './actions';
import { fieldClass, secondaryButtonClass } from '@/lib/ui';

export function ProblemForm({
  eventId,
  roundId,
  nextNumber,
  scoringFormat,
}: {
  eventId: string;
  roundId: string;
  nextNumber: number;
  scoringFormat: string;
}) {
  const [number, setNumber] = useState(String(nextNumber));
  const [name, setName] = useState('');
  const [topPoints, setTopPoints] = useState('');
  const [zonePoints, setZonePoints] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLeaguePoints = scoringFormat === 'league_points';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const submittedNumber = Number(number);
    const result = await createProblem({
      eventId,
      roundId,
      number: submittedNumber,
      name: name || undefined,
      topPoints: isLeaguePoints && topPoints ? Number(topPoints) : undefined,
      zonePoints: isLeaguePoints && zonePoints ? Number(zonePoints) : undefined,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNumber(String(submittedNumber + 1));
    setName('');
    setTopPoints('');
    setZonePoints('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-cardborder bg-white p-2">
      <input
        type="number"
        value={number}
        onChange={(event) => setNumber(event.target.value)}
        required
        min={1}
        className={`w-20 ${fieldClass}`}
      />
      <input
        type="text"
        placeholder="Nombre (opcional)"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={fieldClass}
      />
      {isLeaguePoints && (
        <>
          <input
            type="number"
            placeholder="Puntos por top"
            value={topPoints}
            onChange={(event) => setTopPoints(event.target.value)}
            min={0}
            className={`w-32 ${fieldClass}`}
          />
          <input
            type="number"
            placeholder="Puntos por zona (opcional)"
            value={zonePoints}
            onChange={(event) => setZonePoints(event.target.value)}
            min={0}
            className={`w-40 ${fieldClass}`}
          />
        </>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
        Agregar bloque
      </button>
    </form>
  );
}
```

- [ ] **Step 10: Accept the new fields in the server action**

In `apps/web/app/(organizer)/panel/events/[id]/actions.ts`, change the `createProblemInputSchema` from:

```ts
const createProblemInputSchema = z.object({
  eventId: z.string().uuid(),
  roundId: z.string().uuid(),
  number: z.number().int().positive(),
  name: z.string().min(1).optional(),
});
```

to:

```ts
const createProblemInputSchema = z.object({
  eventId: z.string().uuid(),
  roundId: z.string().uuid(),
  number: z.number().int().positive(),
  name: z.string().min(1).optional(),
  topPoints: z.number().int().nonnegative().optional(),
  zonePoints: z.number().int().nonnegative().optional(),
});
```

No other change is needed in `createProblem` — it already spreads `problemInput` (everything but `eventId`/`roundId`) into the `db.insert(problems).values({...})` call, so `topPoints`/`zonePoints` flow through automatically once they're in the parsed schema.

- [ ] **Step 11: Typecheck the web app**

Run: `pnpm --filter @crux/web exec tsc --noEmit`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/schema.test.ts packages/db/drizzle apps/web/app/\(organizer\)/panel/events/\[id\]/problem-form.tsx apps/web/app/\(organizer\)/panel/events/\[id\]/event-structure.tsx apps/web/app/\(organizer\)/panel/events/\[id\]/page.tsx apps/web/app/\(organizer\)/panel/events/\[id\]/actions.ts
git commit -m "feat(db,web): add problems.topPoints/zonePoints and organizer form field"
```

---

### Task 5: `max_height` strategy

**Files:**
- Modify: `packages/scoring/src/types.ts`
- Create: `packages/scoring/src/max-height.ts`
- Create: `packages/scoring/src/max-height.test.ts`

**Interfaces:**
- Consumes: `resolveCurrentAttempts`, `assignRanks`, `makeAttempt` (Task 1), `Attempt` from `@crux/core`.
- Produces: `interface MaxHeightResult { format: 'max_height'; rank: number; tied: boolean; registrationId: string; height: number }`
- Produces: `scoreMaxHeight(attempts: Attempt[], config: RoundScoringConfig): MaxHeightResult[]`

- [ ] **Step 1: Add `MaxHeightResult` and widen `RankedResult` to its final 4-member form**

In `packages/scoring/src/types.ts`, add after `LeaguePointsResult`:

```ts
export interface MaxHeightResult {
  format: 'max_height';
  rank: number;
  tied: boolean;
  registrationId: string;
  height: number;
}
```

Change:

```ts
export type RankedResult = ClassicTopsZonesResult | IfscBoulderResult | LeaguePointsResult;
```

to:

```ts
export type RankedResult =
  | ClassicTopsZonesResult
  | IfscBoulderResult
  | LeaguePointsResult
  | MaxHeightResult;
```

- [ ] **Step 2: Write the failing tests**

Create `packages/scoring/src/max-height.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scoreMaxHeight } from './max-height';
import { makeAttempt } from './test-support';

describe('scoreMaxHeight', () => {
  it('ranks a higher height first', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 12.5 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, height: 8 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => [r.registrationId, r.height])).toEqual([
      ['reg-a', 12.5],
      ['reg-b', 8],
    ]);
  });

  it('uses the max height across multiple problems in the round, not the sum or the first', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 10 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, height: 15 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result[0]).toMatchObject({ height: 15 });
  });

  it('treats a missing height as 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: null }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result[0]).toMatchObject({ height: 0 });
  });

  it('gives a real tie at an identical decimal height the same rank', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 14.5 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, height: 14.5 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('ranks a registration with zero attempts last, at height 0', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, height: 10 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-dns'] };

    const result = scoreMaxHeight(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ height: 0 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @crux/scoring exec vitest run src/max-height.test.ts`
Expected: FAIL — `Cannot find module './max-height'`

- [ ] **Step 4: Implement `scoreMaxHeight`**

Create `packages/scoring/src/max-height.ts`:

```ts
import type { Attempt } from '@crux/core';
import { resolveCurrentAttempts } from './resolve-attempts';
import { assignRanks } from './rank-assignment';
import type { MaxHeightResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  height: number;
}

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const height = currentAttempts
    .filter((a) => a.registrationId === registrationId)
    .reduce((max, attempt) => Math.max(max, attempt.height ?? 0), 0);
  return { registrationId, height };
}

function compareAggregates(a: Aggregate, b: Aggregate): number {
  return b.height - a.height;
}

export function scoreMaxHeight(
  attempts: Attempt[],
  config: RoundScoringConfig,
): MaxHeightResult[] {
  const problemIds = new Set(config.problemIds);
  const currentAttempts = resolveCurrentAttempts(attempts, problemIds);

  const aggregates = config.registrationIds
    .map((registrationId) => aggregate(registrationId, currentAttempts))
    .sort(compareAggregates);

  const ranks = assignRanks(aggregates, (a, b) => compareAggregates(a, b) === 0);

  return aggregates.map((current, index) => ({
    format: 'max_height',
    rank: ranks[index]!.rank,
    tied: ranks[index]!.tied,
    registrationId: current.registrationId,
    height: current.height,
  }));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @crux/scoring exec vitest run src/max-height.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/scoring/src/types.ts packages/scoring/src/max-height.ts packages/scoring/src/max-height.test.ts
git commit -m "feat(scoring): implement max_height ranking"
```

---

### Task 6: Wire all 4 strategies into the registry + barrel exports + full verification

**Files:**
- Modify: `packages/scoring/src/registry.ts`
- Modify: `packages/scoring/src/registry.test.ts`
- Modify: `packages/scoring/src/index.ts`

**Interfaces:**
- Consumes: `scoreClassicTopsZones`, `scoreIfscBoulder` (Task 2), `scoreLeaguePoints` (Task 3), `scoreMaxHeight` (Task 5), `ok` from `@crux/core`.
- Produces: `SCORING_STRATEGIES` with all 4 real implementations (no `notImplemented` stubs remain).

- [ ] **Step 1: Rewrite the registry**

Replace the full contents of `packages/scoring/src/registry.ts` with:

```ts
import { ok } from '@crux/core';
import type { Attempt, Result, ScoringFormat } from '@crux/core';
import { scoreClassicTopsZones } from './classic-tops-zones';
import { scoreIfscBoulder } from './ifsc-boulder';
import { scoreLeaguePoints } from './league-points';
import { scoreMaxHeight } from './max-height';
import type { RankedResult, RoundScoringConfig, ScoringError, ScoringStrategyFn } from './types';

export const SCORING_STRATEGIES: Record<ScoringFormat, ScoringStrategyFn> = {
  classic_tops_zones: (attempts, config) => ok(scoreClassicTopsZones(attempts, config)),
  ifsc_boulder: (attempts, config) => ok(scoreIfscBoulder(attempts, config)),
  league_points: (attempts, config) => ok(scoreLeaguePoints(attempts, config)),
  max_height: (attempts, config) => ok(scoreMaxHeight(attempts, config)),
};

export function scoreRound(
  format: ScoringFormat,
  attempts: Attempt[],
  config: RoundScoringConfig,
): Result<RankedResult[], ScoringError> {
  return SCORING_STRATEGIES[format](attempts, config);
}
```

- [ ] **Step 2: Rewrite the registry tests**

Replace the full contents of `packages/scoring/src/registry.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import type { Attempt } from '@crux/core';
import { scoreRound } from './registry';

const EMPTY_CONFIG = { problemIds: [], registrationIds: [] };
const NO_ATTEMPTS: Attempt[] = [];

describe('scoreRound', () => {
  it.each([
    'classic_tops_zones',
    'ifsc_boulder',
    'league_points',
    'max_height',
  ] as const)('dispatches "%s" and returns an ok result with an empty ranking', (format) => {
    const result = scoreRound(format, NO_ATTEMPTS, EMPTY_CONFIG);
    expect(result).toEqual({ ok: true, value: [] });
  });
});
```

- [ ] **Step 3: Run the registry tests to verify they pass**

Run: `pnpm --filter @crux/scoring exec vitest run src/registry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: Update the barrel exports**

Replace the full contents of `packages/scoring/src/index.ts` with:

```ts
export { scoreRound } from './registry';
export { scoreClassicTopsZones } from './classic-tops-zones';
export { scoreIfscBoulder } from './ifsc-boulder';
export { scoreLeaguePoints } from './league-points';
export { scoreMaxHeight } from './max-height';
export type {
  ClassicTopsZonesResult,
  IfscBoulderResult,
  LeaguePointsResult,
  MaxHeightResult,
  RankedResult,
  RoundScoringConfig,
  ScoringError,
  ScoringStrategyFn,
} from './types';
```

- [ ] **Step 5: Run the full package suite**

Run: `pnpm --filter @crux/scoring test`
Expected: PASS — every test file in the package passes (resolve-attempts, rank-assignment, classic-tops-zones, ifsc-boulder, league-points, max-height, registry).

- [ ] **Step 6: Typecheck the package**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Run the whole monorepo's tests and typecheck to confirm no regressions**

Run: `pnpm test && pnpm typecheck`
Expected: PASS across every package (`@crux/core`, `@crux/scoring`, `@crux/db`, `apps/web`)

- [ ] **Step 8: Commit**

```bash
git add packages/scoring/src/registry.ts packages/scoring/src/registry.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): wire ifsc_boulder, league_points, and max_height into the registry"
```
