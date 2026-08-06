# Scoring: registry + classic tops/zones — Design

First implementation of `packages/scoring`, currently an empty package
(`export {}`). Closes domain decision #2 (CLAUDE.md): "El scoring es
intercambiable" — `ScoringStrategy` exposed as a pure `score(attempts, config)
→ RankedResult[]`, one strategy per gym's format, registered by string key.

`events.scoringFormat` and its `<select>` already exist end to end
(`apps/web/app/(organizer)/panel/events/new/create-event-form.tsx` and
`actions.ts`, Zod-validated to `'ifsc_boulder' | 'classic_tops_zones' |
'league_points' | 'max_height'`). No DB migration, no UI work — this slice is
entirely inside `packages/scoring` (plus one type narrowing in
`packages/core`).

## Goal

Given a round's current `Attempt` rows, rank every registration in that round
according to one of four formats. Only `classic_tops_zones` computes a real
ranking today; the other three are registered but throw — the registry
exists for all four (validating CLAUDE.md's "≥3 concrete uses" bar for the
abstraction) without pretending the unimplemented ones work.

## Scope for this slice

- `classic_tops_zones`: fully implemented, with tie-break tests against real
  scenarios.
- `ifsc_boulder`, `league_points`, `max_height`: registered stubs, each
  throws `Error('scoring format "<x>" not implemented yet')`.
- `ScoringFormat` narrowed from `string` to the 4-value literal union in
  `packages/core` (the placeholder type and comment pointing at this
  registry already exist there).

Not in scope: wiring `scoreRound()` into any `apps/web` route (leaderboard,
judge capture) — that's a separate slice once a real caller needs it.

## Types (`packages/scoring/src/index.ts` and new files under `src/`)

```ts
// packages/core/src/index.ts — narrow the existing placeholder
export type ScoringFormat =
  | 'ifsc_boulder'
  | 'classic_tops_zones'
  | 'league_points'
  | 'max_height';
```

```ts
// packages/scoring/src/types.ts
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

// Union of one today; each shipped strategy adds its own variant.
export type RankedResult = ClassicTopsZonesResult;

export type ScoringStrategyFn = (
  attempts: Attempt[],
  config: RoundScoringConfig,
) => RankedResult[];
```

```ts
// packages/scoring/src/registry.ts
export const SCORING_STRATEGIES: Record<ScoringFormat, ScoringStrategyFn> = {
  classic_tops_zones: scoreClassicTopsZones,
  ifsc_boulder: notImplemented('ifsc_boulder'),
  league_points: notImplemented('league_points'),
  max_height: notImplemented('max_height'),
};

export function scoreRound(
  format: ScoringFormat,
  attempts: Attempt[],
  config: RoundScoringConfig,
): RankedResult[] {
  return SCORING_STRATEGIES[format](attempts, config);
}
```

`scoreRound` is the one public entry point future callers (leaderboard,
judge UI) use — they never reach into `SCORING_STRATEGIES` directly.

## Algorithm — `classic_tops_zones`

1. Filter `attempts` to rows whose `problemId` is in `config.problemIds`
   (drops anything from another round that leaked in).
2. Resolve the current attempt per `(registrationId, problemId)`: the row
   with the highest `sequence` wins; earlier rows (superseded corrections)
   are discarded. This resolution happens *inside* the strategy — the input
   is the raw append-only log, not a pre-resolved view — because "which
   attempt counts" is scoring/business logic, not persistence (domain
   decision #1, and the dependency rule: `packages/db` holds no business
   logic).
3. Every `registrationId` in `config.registrationIds` gets a result, even
   with zero attempts anywhere (DNS: `tops: 0, topAttempts: 0, zones: 0,
   zoneAttempts: 0`, ranked last).
4. Per registration, aggregate across its resolved current attempts:
   - `tops` = count of problems where the current attempt has `top: true`.
   - `topAttempts` = sum of `topAttempts` **only** for problems actually
     topped (a failed problem's spent attempts don't count against the
     tiebreak — the miss is already punished by a lower `tops`).
   - `zones` / `zoneAttempts` computed the same way against `zone`.
5. Sort by: `tops` desc → `topAttempts` asc → `zones` desc → `zoneAttempts`
   asc.
6. Assign standard competition ranking: identical stats on all four fields
   → same `rank`, `tied: true` for every member of that group; the next
   distinct rank skips ahead by the group size (1, 1, 3, 4...).

## Stub strategies

`ifsc_boulder`, `league_points`, `max_height` are each a one-line function
that throws instead of returning `[]`, so a caller can't mistake "not
implemented" for "nobody scored." Not modeled as `NotImplementedError` class
or shared factory beyond the tiny `notImplemented(format)` helper that
builds the message — three near-identical throw statements don't need more
structure than that.

## Error handling

- Unknown `ScoringFormat` string reaching `scoreRound` can't happen at the
  type level (the union is exhaustive) — no runtime "unknown format" branch
  needed.
- Stub formats throw synchronously; it's the caller's job (future slice) to
  decide how that surfaces in the UI. Not this slice's concern.

## Testing (`packages/scoring`, Vitest)

Real scenarios per CLAUDE.md's bar ("cada estrategia necesita tests con
casos de empate reales"):

- Basic ranking, no ties.
- Full tie: two registrations with identical tops/topAttempts/zones/
  zoneAttempts → same rank, both `tied: true`, next athlete's rank skips by
  2.
- Tie broken at `topAttempts` (equal tops, different attempts-to-top).
- Tie broken at `zones` (equal tops and topAttempts, different zones).
- Tie broken at `zoneAttempts` (equal on everything else).
- DNS: a `registrationId` in `config.registrationIds` with zero attempt rows
  ranks last.
- Correction handling: two attempt rows for the same `(registrationId,
  problemId)` with different `sequence` — only the higher one counts.
- Attempt row for a `problemId` outside `config.problemIds` is ignored.
- Each of the 3 stub strategies throws when called via `scoreRound`.

## Explicitly deferred out of this slice

- Implementing `ifsc_boulder`, `league_points`, `max_height` — each gets its
  own design/spec when it's the one a real event needs, same one-at-a-time
  pattern as this slice.
- Wiring `scoreRound()` into any route (leaderboard, judge capture, event
  history).
- Caching or recomputation-on-write strategy for the public leaderboard
  (domain decision #4) — irrelevant until something calls `scoreRound` from
  a request path.
