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
- Zoned if `attempt.zone || attempt.top` (topping implies the zone hold was
  passed — same rule as `classic_tops_zones`). Attempts-to-zone:
  `attempt.zoneAttempts ?? attempt.topAttempts ?? 1`.
- Top score (in tenths of a point, to avoid float drift): topped ?
  `max(0, 250 - 10*... )`

  Concretely, in tenths: `topTenths = topped ? Math.max(0, 250 - (topAttemptsUsed - 1) * 1) : 0`
  (25.0 points = 250 tenths; each attempt after the first costs 0.1 point = 1 tenth; floor 0).
- Zone score (tenths): `zoneTenths = zoned ? Math.max(0, 100 - (zoneAttemptsUsed - 1) * 1) : 0`
  (10.0 points = 100 tenths).
- **Top and zone points are additive** — topping a problem in one attempt is
  worth 35.0 points (25 + 10), not 25. This matches the real IFSC
  post-2018 scoring format; it's the one place this format's math diverges
  from `classic_tops_zones`' zone-crediting (which doesn't award separate
  points, only tiebreak position).
- Problem score = `topTenths + zoneTenths`. Registration score = sum of
  problem scores across `config.problemIds`, converted to points
  (`totalTenths / 10`) only at the very end, so all arithmetic before that
  stays in integer tenths.

Ranking: score desc. A real tie (identical total score) shares a rank — no
secondary tiebreak criterion for this format.

```ts
export interface IfscBoulderResult {
  format: 'ifsc_boulder';
  rank: number;
  tied: boolean;
  registrationId: string;
  score: number; // e.g. 35, or 47.3
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
optional number inputs, **shown only when the event's `scoringFormat` is
`'league_points'`** (the form needs the event's `scoringFormat` passed down
as a new prop from the page that renders it — currently it only receives
`eventId`, `roundId`, `nextNumber`). `createProblem`'s Zod schema
(`apps/web/app/(organizer)/panel/events/[id]/actions.ts`) gains
`topPoints: z.number().int().optional()` and
`zonePoints: z.number().int().optional()`.

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
ships — `notImplemented` and the `ScoringError` type stay defined (a future
5th format would use them again) but nothing currently constructs an `err`.

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
- Top in 1 attempt scores 35 (25 top + 10 zone), both floors untested (no deduction).
- Top in 3 attempts: top score floored/deducted correctly (25 - 0.2 = 24.8), zone score uses its own (possibly different) attempt count.
- Zone only (no top): only the 10-point zone formula applies, deducted by zone attempts.
- Neither top nor zone: 0.
- A deduction run long enough to hit the 0 floor (attempts count high enough that `250 - (n-1) < 0`).
- Multiple problems summed correctly into one registration score.
- Real tie: two registrations with identical total score share a rank.
- DNS: zero attempts scores 0, ranks last.
- `resolveCurrentAttempts`'s correction-resolution behavior carries over correctly (one shared test via the extracted helper, not re-proven per strategy).

**`league_points`:**
- Topped problem scores its configured `topPoints`.
- Zoned-not-topped problem with `zonePoints` set scores that value.
- Zoned-not-topped problem with `zonePoints: null` scores 0 (toggle off for that block).
- Topped problem does NOT additionally score `zonePoints` (not additive — the one behavioral difference from `ifsc_boulder` to pin with a test).
- A problem missing from `problemPoints` entirely scores 0 regardless of top/zone.
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
