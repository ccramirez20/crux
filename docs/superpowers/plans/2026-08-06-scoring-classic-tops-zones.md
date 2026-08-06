# Scoring: Registry + Classic Tops/Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `packages/scoring` its first real implementation — a `scoreRound(format, attempts, config)` dispatcher backed by a registry of all 4 `scoringFormat` values, with `classic_tops_zones` fully computing a tie-broken ranking and the other 3 formats registered as `Result`-returning "not implemented" stubs.

**Architecture:** A generic `Result<T, E>` lands in `packages/core` (first use in the codebase, required by CLAUDE.md's error-handling rule for domain code). `packages/scoring` gets a pure, total `scoreClassicTopsZones(attempts, config): ClassicTopsZonesResult[]` that resolves each `(registrationId, problemId)` to its highest-`sequence` attempt row and ranks by tops → top-attempts → zones → zone-attempts. A registry (`Record<ScoringFormat, ScoringStrategyFn>`) wraps that function and 3 stubs uniformly behind `Result<RankedResult[], ScoringError>`, and `scoreRound` is the single public dispatcher.

**Tech Stack:** TypeScript strict, Vitest, pnpm workspaces (`@crux/core`, `@crux/scoring`).

## Global Constraints

- No `any`. No `as` to silence the compiler. (CLAUDE.md)
- `packages/core` and `packages/scoring` import nothing from `db`, `next`, or network — pure functions only. (CLAUDE.md)
- Errors: `Result<T, E>` in domain code; exceptions only at IO boundaries. `packages/scoring` has no IO, so nothing in it throws for an expected condition. (CLAUDE.md)
- Tests are mandatory in `packages/core` and `packages/scoring`, including for the tiny `Result` helpers. (CLAUDE.md)
- Every scoring strategy needs tests against real tie-break scenarios before it counts as done. (CLAUDE.md, domain decision #2)
- `topAttempts`/`zoneAttempts` only accumulate for problems actually topped/zoned — attempts spent on a problem that was never completed don't count toward the tiebreak. (spec: Algorithm)
- Standard competition ranking: a full tie shares one rank number; the next distinct rank skips ahead by the tie group's size (1, 1, 3). (spec: Algorithm)
- `scoreClassicTopsZones` itself has no failure mode and returns a plain array — `Result` wrapping happens one layer up, in the registry, where the real "format not implemented" failure lives. (spec: Types)
- Out of scope for this slice: implementing `ifsc_boulder`, `league_points`, `max_height`; wiring `scoreRound` into any `apps/web` route; leaderboard caching. (spec: Explicitly deferred)

---

### Task 1: `Result<T, E>` in `packages/core` + `packages/scoring` package setup

**Files:**
- Create: `packages/core/src/result.ts`
- Create: `packages/core/src/result.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/scoring/package.json`

**Interfaces:**
- Produces: `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
- Produces: `ok<T>(value: T): Result<T, never>`
- Produces: `err<E>(error: E): Result<never, E>`
- Produces: `type ScoringFormat = 'ifsc_boulder' | 'classic_tops_zones' | 'league_points' | 'max_height'` (narrowed from `string`)

- [ ] **Step 1: Write the failing test for `Result`**

Create `packages/core/src/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('ok', () => {
  it('wraps a value as a successful result', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });
});

describe('err', () => {
  it('wraps an error as a failed result', () => {
    expect(err('bad input')).toEqual({ ok: false, error: 'bad input' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @crux/core exec vitest run src/result.test.ts`
Expected: FAIL — `Cannot find module './result'`

- [ ] **Step 3: Implement `Result`**

Create `packages/core/src/result.ts`:

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

- [ ] **Step 4: Export `Result` and narrow `ScoringFormat` in the barrel**

In `packages/core/src/index.ts`, replace:

```ts
/**
 * Identifier for a packages/scoring strategy. The registry of valid values
 * (and the score() function that reads them) lives in packages/scoring, not
 * here — core stays IO- and logic-free.
 */
export type ScoringFormat = string;
```

with:

```ts
/**
 * Identifier for a packages/scoring strategy. The registry mapping each
 * value to its score() function lives in packages/scoring, not here — core
 * stays IO- and logic-free.
 */
export type ScoringFormat =
  | 'ifsc_boulder'
  | 'classic_tops_zones'
  | 'league_points'
  | 'max_height';
```

Then add, near the bottom of the same file (next to the other re-exports):

```ts
export { ok, err } from './result';
export type { Result } from './result';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @crux/core exec vitest run src/result.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full `@crux/core` suite to check for regressions**

Run: `pnpm --filter @crux/core test`
Expected: PASS (all existing `eligibility.test.ts` tests plus the 2 new ones) — confirms narrowing `ScoringFormat` didn't break anything (nothing else in the repo currently imports it).

- [ ] **Step 7: Wire up `packages/scoring`'s dependencies**

Replace `packages/scoring/package.json` with:

```json
{
  "name": "@crux/scoring",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "lint": "echo 'sin lint todavia'",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@crux/core": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 8: Install**

Run: `pnpm install`
Expected: lockfile updates, `@crux/scoring` now resolves `@crux/core` and `vitest`.

- [ ] **Step 9: Typecheck both packages**

Run: `pnpm --filter @crux/core exec tsc --noEmit && pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: both pass with no errors (scoring's `src/index.ts` is still just `export {};`).

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/result.ts packages/core/src/result.test.ts packages/core/src/index.ts packages/scoring/package.json pnpm-lock.yaml
git commit -m "feat(core): add Result<T,E>, narrow ScoringFormat; wire up @crux/scoring deps"
```

---

### Task 2: `scoreClassicTopsZones` in `packages/scoring`

**Files:**
- Create: `packages/scoring/src/types.ts`
- Create: `packages/scoring/src/classic-tops-zones.ts`
- Create: `packages/scoring/src/classic-tops-zones.test.ts`

**Interfaces:**
- Consumes: `Attempt`, `Result`, `ScoringFormat` from `@crux/core` (`Attempt` fields used: `registrationId: string`, `problemId: string`, `sequence: number`, `top: boolean`, `topAttempts: number | null`, `zone: boolean`, `zoneAttempts: number | null`).
- Produces: `interface RoundScoringConfig { problemIds: string[]; registrationIds: string[] }`
- Produces: `interface ClassicTopsZonesResult { format: 'classic_tops_zones'; rank: number; tied: boolean; registrationId: string; tops: number; topAttempts: number; zones: number; zoneAttempts: number }`
- Produces: `type RankedResult = ClassicTopsZonesResult`
- Produces: `interface ScoringError { format: ScoringFormat; message: string }`
- Produces: `type ScoringStrategyFn = (attempts: Attempt[], config: RoundScoringConfig) => Result<RankedResult[], ScoringError>`
- Produces: `scoreClassicTopsZones(attempts: Attempt[], config: RoundScoringConfig): ClassicTopsZonesResult[]` — note this function itself returns a plain array, not a `Result` (see Global Constraints).

- [ ] **Step 1: Create the shared types**

Create `packages/scoring/src/types.ts`:

```ts
import type { Attempt, Result, ScoringFormat } from '@crux/core';

export interface RoundScoringConfig {
  problemIds: string[];
  registrationIds: string[];
}

export interface ClassicTopsZonesResult {
  format: 'classic_tops_zones';
  rank: number;
  tied: boolean;
  registrationId: string;
  tops: number;
  topAttempts: number;
  zones: number;
  zoneAttempts: number;
}

// Union of one today; each shipped strategy adds its own variant here.
export type RankedResult = ClassicTopsZonesResult;

export interface ScoringError {
  format: ScoringFormat;
  message: string;
}

export type ScoringStrategyFn = (
  attempts: Attempt[],
  config: RoundScoringConfig,
) => Result<RankedResult[], ScoringError>;
```

- [ ] **Step 2: Write the failing tests**

Create `packages/scoring/src/classic-tops-zones.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Attempt } from '@crux/core';
import { scoreClassicTopsZones } from './classic-tops-zones';

let attemptCounter = 0;
function makeAttempt(
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

describe('scoreClassicTopsZones', () => {
  it('ranks by tops first, more tops wins', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, top: true, topAttempts: 2 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 3, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p2', sequence: 4, zone: true, zoneAttempts: 1 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result).toEqual([
      { format: 'classic_tops_zones', rank: 1, tied: false, registrationId: 'reg-a', tops: 2, topAttempts: 3, zones: 0, zoneAttempts: 0 },
      { format: 'classic_tops_zones', rank: 2, tied: false, registrationId: 'reg-b', tops: 1, topAttempts: 1, zones: 1, zoneAttempts: 1 },
    ]);
  });

  it('gives a full tie the same rank and skips the next rank by the group size', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-c', problemId: 'p1', sequence: 3, top: false }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b', 'reg-c'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => [r.registrationId, r.rank, r.tied])).toEqual([
      ['reg-a', 1, true],
      ['reg-b', 1, true],
      ['reg-c', 3, false],
    ]);
  });

  it('breaks a tie in tops by fewer attempts to top', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 3 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-b', 'reg-a']);
  });

  it('breaks a tie in tops and top-attempts by more zones', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p2', sequence: 2, zone: true, zoneAttempts: 2 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 3, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1', 'p2'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-b']);
  });

  it('breaks a tie in tops, top-attempts, and zones by fewer attempts to zone', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, zone: true, zoneAttempts: 3 }),
      makeAttempt({ registrationId: 'reg-b', problemId: 'p1', sequence: 2, zone: true, zoneAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-b'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-b', 'reg-a']);
  });

  it('ranks a registration with zero attempts last, as a DNS', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a', 'reg-dns'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result.map((r) => r.registrationId)).toEqual(['reg-a', 'reg-dns']);
    expect(result[1]).toMatchObject({ tops: 0, topAttempts: 0, zones: 0, zoneAttempts: 0 });
  });

  it('only counts the highest-sequence attempt when a correction supersedes an earlier one', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: false, topAttempts: null }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 2, top: true, topAttempts: 4 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result[0]).toMatchObject({ tops: 1, topAttempts: 4 });
  });

  it('ignores attempts for a problem outside the round', () => {
    const attempts = [
      makeAttempt({ registrationId: 'reg-a', problemId: 'p1', sequence: 1, top: true, topAttempts: 1 }),
      makeAttempt({ registrationId: 'reg-a', problemId: 'other-round-problem', sequence: 2, top: true, topAttempts: 1 }),
    ];
    const config = { problemIds: ['p1'], registrationIds: ['reg-a'] };

    const result = scoreClassicTopsZones(attempts, config);

    expect(result[0]).toMatchObject({ tops: 1, topAttempts: 1 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @crux/scoring exec vitest run src/classic-tops-zones.test.ts`
Expected: FAIL — `Cannot find module './classic-tops-zones'`

- [ ] **Step 4: Implement `scoreClassicTopsZones`**

Create `packages/scoring/src/classic-tops-zones.ts`:

```ts
import type { Attempt } from '@crux/core';
import type { ClassicTopsZonesResult, RoundScoringConfig } from './types';

interface Aggregate {
  registrationId: string;
  tops: number;
  topAttempts: number;
  zones: number;
  zoneAttempts: number;
}

function resolveCurrentAttempts(attempts: Attempt[], problemIds: Set<string>): Attempt[] {
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

function aggregate(registrationId: string, currentAttempts: Attempt[]): Aggregate {
  const forRegistration = currentAttempts.filter((a) => a.registrationId === registrationId);
  let tops = 0;
  let topAttempts = 0;
  let zones = 0;
  let zoneAttempts = 0;
  for (const attempt of forRegistration) {
    if (attempt.top) {
      tops += 1;
      topAttempts += attempt.topAttempts ?? 0;
    }
    if (attempt.zone) {
      zones += 1;
      zoneAttempts += attempt.zoneAttempts ?? 0;
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

function isTiedWith(a: Aggregate, b: Aggregate): boolean {
  return (
    a.tops === b.tops &&
    a.topAttempts === b.topAttempts &&
    a.zones === b.zones &&
    a.zoneAttempts === b.zoneAttempts
  );
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

  const results: ClassicTopsZonesResult[] = [];
  for (let index = 0; index < aggregates.length; index++) {
    const current = aggregates[index]!;
    const previous = index > 0 ? aggregates[index - 1]! : null;
    const tiedWithPrevious = previous !== null && isTiedWith(current, previous);
    const rank = tiedWithPrevious ? results[index - 1]!.rank : index + 1;
    results.push({
      format: 'classic_tops_zones',
      rank,
      tied: false,
      registrationId: current.registrationId,
      tops: current.tops,
      topAttempts: current.topAttempts,
      zones: current.zones,
      zoneAttempts: current.zoneAttempts,
    });
  }

  for (let index = 0; index < results.length; index++) {
    const sharesRankWithPrevious = index > 0 && results[index]!.rank === results[index - 1]!.rank;
    const sharesRankWithNext =
      index < results.length - 1 && results[index]!.rank === results[index + 1]!.rank;
    results[index]!.tied = sharesRankWithPrevious || sharesRankWithNext;
  }

  return results;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @crux/scoring exec vitest run src/classic-tops-zones.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/scoring/src/types.ts packages/scoring/src/classic-tops-zones.ts packages/scoring/src/classic-tops-zones.test.ts
git commit -m "feat(scoring): implement classic_tops_zones ranking"
```

---

### Task 3: Registry + `scoreRound` dispatcher

**Files:**
- Create: `packages/scoring/src/registry.ts`
- Create: `packages/scoring/src/registry.test.ts`

**Interfaces:**
- Consumes: `scoreClassicTopsZones` from `./classic-tops-zones` (Task 2); `ok`, `err` from `@crux/core` (Task 1); `RankedResult`, `RoundScoringConfig`, `ScoringError`, `ScoringStrategyFn` from `./types` (Task 2).
- Produces: `SCORING_STRATEGIES: Record<ScoringFormat, ScoringStrategyFn>`
- Produces: `scoreRound(format: ScoringFormat, attempts: Attempt[], config: RoundScoringConfig): Result<RankedResult[], ScoringError>`

- [ ] **Step 1: Write the failing tests**

Create `packages/scoring/src/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Attempt } from '@crux/core';
import { scoreRound } from './registry';

const EMPTY_CONFIG = { problemIds: [], registrationIds: [] };
const NO_ATTEMPTS: Attempt[] = [];

describe('scoreRound', () => {
  it('dispatches classic_tops_zones and returns ok', () => {
    const result = scoreRound('classic_tops_zones', NO_ATTEMPTS, EMPTY_CONFIG);
    expect(result).toEqual({ ok: true, value: [] });
  });

  it.each(['ifsc_boulder', 'league_points', 'max_height'] as const)(
    'returns an error result for the unimplemented "%s" format',
    (format) => {
      const result = scoreRound(format, NO_ATTEMPTS, EMPTY_CONFIG);
      expect(result).toEqual({
        ok: false,
        error: { format, message: `scoring format "${format}" not implemented yet` },
      });
    },
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @crux/scoring exec vitest run src/registry.test.ts`
Expected: FAIL — `Cannot find module './registry'`

- [ ] **Step 3: Implement the registry and dispatcher**

Create `packages/scoring/src/registry.ts`:

```ts
import { err, ok } from '@crux/core';
import type { Attempt, Result, ScoringFormat } from '@crux/core';
import { scoreClassicTopsZones } from './classic-tops-zones';
import type { RankedResult, RoundScoringConfig, ScoringError, ScoringStrategyFn } from './types';

function notImplemented(format: ScoringFormat): ScoringStrategyFn {
  return () => err({ format, message: `scoring format "${format}" not implemented yet` });
}

export const SCORING_STRATEGIES: Record<ScoringFormat, ScoringStrategyFn> = {
  classic_tops_zones: (attempts, config) => ok(scoreClassicTopsZones(attempts, config)),
  ifsc_boulder: notImplemented('ifsc_boulder'),
  league_points: notImplemented('league_points'),
  max_height: notImplemented('max_height'),
};

export function scoreRound(
  format: ScoringFormat,
  attempts: Attempt[],
  config: RoundScoringConfig,
): Result<RankedResult[], ScoringError> {
  return SCORING_STRATEGIES[format](attempts, config);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @crux/scoring exec vitest run src/registry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/scoring/src/registry.ts packages/scoring/src/registry.test.ts
git commit -m "feat(scoring): add format registry and scoreRound dispatcher"
```

---

### Task 4: Public barrel exports + full verification

**Files:**
- Modify: `packages/scoring/src/index.ts`

**Interfaces:**
- Consumes: everything produced in Tasks 2 and 3.
- Produces: the package's public surface — `scoreRound`, `SCORING_STRATEGIES`, `scoreClassicTopsZones`, and the types `ClassicTopsZonesResult`, `RankedResult`, `RoundScoringConfig`, `ScoringError`, `ScoringStrategyFn`.

- [ ] **Step 1: Replace the barrel**

Replace `packages/scoring/src/index.ts` (currently `export {};`) with:

```ts
export { scoreRound, SCORING_STRATEGIES } from './registry';
export { scoreClassicTopsZones } from './classic-tops-zones';
export type {
  ClassicTopsZonesResult,
  RankedResult,
  RoundScoringConfig,
  ScoringError,
  ScoringStrategyFn,
} from './types';
```

- [ ] **Step 2: Run the full `@crux/scoring` suite**

Run: `pnpm --filter @crux/scoring test`
Expected: PASS (12 tests total — 8 from `classic-tops-zones.test.ts`, 4 from `registry.test.ts`)

- [ ] **Step 3: Typecheck the package**

Run: `pnpm --filter @crux/scoring exec tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run the whole monorepo's tests and typecheck to confirm no regressions**

Run: `pnpm test && pnpm typecheck`
Expected: PASS across every package (`@crux/core`, `@crux/scoring`, `apps/web`, `@crux/db`)

- [ ] **Step 5: Commit**

```bash
git add packages/scoring/src/index.ts
git commit -m "feat(scoring): export public API from package barrel"
```
