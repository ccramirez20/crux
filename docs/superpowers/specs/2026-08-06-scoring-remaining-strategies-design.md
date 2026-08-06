# Scoring: ifsc_boulder, league_points, max_height — Design

Implements the 3 `ScoringFormat` stubs left by the previous slice
(`docs/superpowers/specs/2026-08-06-scoring-classic-tops-zones-design.md`),
which deliberately deferred them one-at-a-time. Closes out `packages/scoring`
for etapa 1: all 4 formats the app's event-creation form already offers
become real.

## Shared refactor (do this first)

`classic-tops-zones.ts` currently has two private helpers that every new
strategy also needs:

- `resolveCurrentAttempts(attempts, problemIds)` — keeps only the
  highest-`sequence` row per `(registrationId, problemId)`.
- The rank/tied assignment loop that turns a sorted array into `{rank,
  tied}` pairs using standard competition ranking (ties share a rank; the
  next rank skips ahead by the tie group's size).

With 4 strategies needing both, this crosses CLAUDE.md's "≥3 concrete uses"
bar for extracting an abstraction. Both move to shared modules:

```ts
// packages/scoring/src/resolve-attempts.ts
export function resolveCurrentAttempts(attempts: Attempt[], problemIds: Set<string>): Attempt[]
```

```ts
// packages/scoring/src/rank-assignment.ts
export function assignRanks<T>(
  sorted: T[],
  isTiedWithPrevious: (a: T, b: T) => boolean,
): { rank: number; tied: boolean }[]
```

`classic-tops-zones.ts` is refactored to import both instead of defining its
own copies. Its existing 11 tests must pass unchanged after the refactor —
this is a pure extraction, not a behavior change.

## `ifsc_boulder`

Uses the existing `RoundScoringConfig` (`problemIds`, `registrationIds`) —
no new config needed.

Per problem, using the current (highest-`sequence`) attempt:
- Topped if `attempt.top`. Attempts-to-top: `attempt.topAttempts ?? 1` (same
  null-defaulting rule as `classic_tops_zones` — a top can't happen in zero
  attempts).
- Not topped, but zoned if `attempt.zone`. Attempts-to-zone:
  `attempt.zoneAttempts ?? 1`.
- **Top and zone points are NOT additive** (this corrects an earlier draft
  of this spec, which claimed IFSC sums them — it doesn't; real IFSC scores
  a boulder at the value of the *highest* achievement reached, the same
  "best achievement wins" shape `league_points` already uses, not a sum).
  A topped problem scores `max(0, 250 - (topAttemptsUsed - 1) * 1)` tenths
  (25.0 points = 250 tenths; each attempt after the first costs 0.1 point =
  1 tenth; floored at 0). A zoned-not-topped problem scores
  `max(0, 100 - (zoneAttemptsUsed - 1) * 1)` tenths (10.0 = 100 tenths,
  same deduction/floor). Neither → 0. Since only one of the two formulas
  ever applies to a given problem, there is no "topping implies zone" rule
  here — unlike `classic_tops_zones`, zoning is never separately credited
  once a problem is topped.
- Registration score = sum of each problem's score (across different
  problems, scores DO add — the non-additivity is within one problem's
  top-vs-zone choice, not across the round). Converted to points
  (`totalTenths / 10`) only at the very end; all arithmetic before that
  stays in integer tenths.

Ranking: score desc. A real tie (identical total score) shares a rank — no
secondary tiebreak criterion for this format.

```ts
export interface IfscBoulderResult {
  format: 'ifsc_boulder';
  rank: number;
  tied: boolean;
  registrationId: string;
  score: number; // e.g. 25 (a clean top), or 34.7
}
```

## `league_points`

`RoundScoringConfig` gains one optional field, used only by this strategy
(every other strategy ignores it):

```ts
export interface RoundScoringConfig {
  problemIds: string[];
  registrationIds: string[];
  problemPoints?: Record<string, { topPoints: number; zonePoints: number | null }>;
}
```

Per problem, using the current attempt:
- Topped → `problemPoints?.[problemId]?.topPoints ?? 0`.
- Not topped, but zoned (`attempt.zone === true` — no top-implies-zone here,
  since this format's zone credit is a deliberate secondary/partial score,
  not a tiebreak nicety) **and** `problemPoints?.[problemId]?.zonePoints` is
  a number (not `null`/absent) → that value.
- Otherwise → 0.
- Top and zone points are **not** additive here (unlike `ifsc_boulder`): a
  topped problem scores `topPoints` only. `zonePoints: null` on a block (or
  the block missing from `problemPoints` entirely) means "this block gives
  no partial credit for zoning" — this is the per-block on/off toggle the
  product decision asked for; there's no separate boolean column for it.

Registration score = sum of problem scores across `config.problemIds`.
Ranking: score desc. Real tie shares a rank, no secondary criterion.

```ts
export interface LeaguePointsResult {
  format: 'league_points';
  rank: number;
  tied: boolean;
  registrationId: string;
  score: number;
}
```

### Data model change

`problems` gains two nullable columns (new migration, never editing an
applied one):

```ts
topPoints: integer('top_points'),
zonePoints: integer('zone_points'),
```

Both nullable because they're only meaningful for `league_points` events —
every other format's problems leave them `null`. If an organizer runs a
`league_points` event and leaves `topPoints` unset on a problem, that
problem contributes 0 to every registration's score (silent zero, not an
error — this is a data-entry gap, not a scoring-engine failure, consistent
with how the rest of this package treats missing optional judge data).

### UI change

`apps/web/app/(organizer)/panel/events/[id]/problem-form.tsx` gains two
number inputs, **shown only when the event's `scoringFormat` is
`'league_points'`** (the form needs the event's `scoringFormat` passed down
as a new prop from the page that renders it — currently it only receives
`eventId`, `roundId`, `nextNumber`). `topPoints` is **required** whenever
it's shown (a `league_points` block with no top value would score less for
topping than for zoning, an inverted leaderboard — leaving it optional
would let that ship); `zonePoints` stays optional (that's the block's
zone-credit toggle, `null`/unset is a valid "off" state, not a data gap).
`createProblem`'s Zod schema
(`apps/web/app/(organizer)/panel/events/[id]/actions.ts`) gains
`topPoints: z.number().int().nonnegative().optional()` and
`zonePoints: z.number().int().nonnegative().optional()` — both stay
`.optional()` at the Zod/DB level since they're meaningless for the other 3
formats; the `required` HTML attribute enforces the league_points-specific
rule client-side, in the same conditionally-rendered block.

## `max_height`

Uses the existing `RoundScoringConfig` — no new config needed.

Per registration: the highest `attempt.height` among their current attempts
across `config.problemIds` (a lead round is expected to have exactly one
problem in etapa 1's usage, but this handles the model's generality —
multiple problems in a round — by taking the max rather than assuming
exactly one). A registration with no attempts, or whose only attempts have
`height: null`, scores `0` (ranks last, same DNS treatment as the other
three formats).

Ranking: height desc. Real tie (identical height, including decimals — the
DB column is `numeric`, so a judge-recorded "45+" some competitions notate
as `45.5` sorts correctly with no special "+"-parsing needed here) shares a
rank, no secondary criterion.

```ts
export interface MaxHeightResult {
  format: 'max_height';
  rank: number;
  tied: boolean;
  registrationId: string;
  height: number;
}
```

## Registry changes

`packages/scoring/src/registry.ts`: the 3 `notImplemented(...)` entries in
`SCORING_STRATEGIES` are replaced with real implementations, each wrapped
in `ok(...)` exactly like `classic_tops_zones` already is:

```ts
export const SCORING_STRATEGIES: Record<ScoringFormat, ScoringStrategyFn> = {
  classic_tops_zones: (attempts, config) => ok(scoreClassicTopsZones(attempts, config)),
  ifsc_boulder: (attempts, config) => ok(scoreIfscBoulder(attempts, config)),
  league_points: (attempts, config) => ok(scoreLeaguePoints(attempts, config)),
  max_height: (attempts, config) => ok(scoreMaxHeight(attempts, config)),
};
```

No more `Result`-returning error paths remain in this package once this
ships. The `notImplemented` helper is deleted along with it (dead code —
nothing calls it once all 4 formats are real); `ScoringError` stays defined
since `ScoringStrategyFn`'s signature still returns `Result<RankedResult[],
ScoringError>` and a future 5th format would construct one again.

`RankedResult` grows to a 4-member union:

```ts
export type RankedResult =
  | ClassicTopsZonesResult
  | IfscBoulderResult
  | LeaguePointsResult
  | MaxHeightResult;
```

`packages/scoring/src/index.ts`'s barrel gains the 3 new score functions and
3 new result types, alongside what it already exports.

## Testing (`packages/scoring`, Vitest)

Per format, real scenarios (CLAUDE.md's bar):

**`ifsc_boulder`:**
- Top in 1 attempt scores 25 (no deduction), not 35 — confirms top-only, not additive.
- Top in 3 attempts: score deducted correctly (25 - 0.2 = 24.8).
- Zone only (no top): the 10-point zone formula applies on its own, deducted by zone attempts.
- Neither top nor zone: 0.
- A deduction run long enough to hit the 0 floor (attempts count high enough that `250 - (n-1) < 0`), for both the top and the zone formula independently.
- Multiple problems summed correctly into one registration score (scores add across *different* problems; the non-additivity is only within one problem's top-vs-zone choice).
- Real tie: two registrations with identical total score share a rank.
- DNS: zero attempts scores 0, ranks last.
- `resolveCurrentAttempts`'s correction-resolution behavior carries over correctly (one shared test via the extracted helper, not re-proven per strategy).

**`league_points`:**
- Topped problem scores its configured `topPoints`.
- Zoned-not-topped problem with `zonePoints` set scores that value.
- Zoned-not-topped problem with `zonePoints: null` scores 0 (toggle off for that block).
- Zoned-not-topped problem missing from `problemPoints` entirely scores 0 (same as the `null` case, via a different code path — both need a test, since it's a different branch).
- Topped problem does NOT additionally score `zonePoints` (not additive — pin this with a test; `ifsc_boulder` shares the same "best achievement wins" shape but via a formula instead of an organizer-set table).
- A topped problem missing from `problemPoints` entirely scores 0.
- Real tie on total score.
- DNS.

**`max_height`:**
- Higher height ranks first.
- Multiple problems in one round: the max across them is used, not the sum or the first.
- `height: null` (no attempt, or an attempt row with height unset) counts as 0.
- Real tie at identical height (including a decimal value).
- DNS.

**Shared refactor:**
- `classic_tops_zones`'s existing 11 tests pass unchanged (regression check on the extraction).
- `resolveCurrentAttempts` and `assignRanks` each get their own focused unit test now that they're standalone modules, independent of any one strategy's test file.

## Explicitly deferred out of this slice

- Wiring `scoreRound()` into any `apps/web` route (leaderboard, judge
  capture) — unchanged from the previous slice's deferral.
- Validating that an organizer actually set `topPoints`/`zonePoints` before
  publishing a `league_points` event — missing values silently score 0
  rather than blocking event creation.
- A 5th scoring format (speed brackets) — still blocked on `attempts`
  having no time/lane column, per the schema's existing deferred-speed
  comment.
