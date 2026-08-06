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
ranking today; the other three are registered but return a `Result` error —
the registry exists for all four (validating CLAUDE.md's "≥3 concrete uses"
bar for the abstraction) without pretending the unimplemented ones work.

- `classic_tops_zones`: fully implemented, with tie-break tests against real
  scenarios.
- `ifsc_boulder`, `league_points`, `max_height`: registered stubs, each
  returns a `Result` error instead of a ranking.
- `ScoringFormat` narrowed from `string` to the 4-value literal union in
  `packages/core` (the placeholder type and comment pointing at this
  registry already exist there).
- `Result<T, E>` introduced in `packages/core` — CLAUDE.md's "Errores"
  section requires it for domain code ("Result<T, E> en dominio; excepciones
  solo en bordes de IO"), and nothing in the codebase defines it yet.
  `packages/scoring` is the first consumer. An earlier draft of this spec had
  the stubs `throw`; that contradicted the stated convention and is
  corrected here before implementation.

Not in scope: wiring `scoreRound()` into any `apps/web` route (leaderboard,
judge capture) — that's a separate slice once a real caller needs it.

## Types (`packages/core` and new files under `packages/scoring/src/`)

```ts
// packages/core/src/result.ts — new, generic, reused by any future domain code
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

```ts
// packages/core/src/index.ts — narrow the existing placeholder, export Result
export type ScoringFormat =
  | 'ifsc_boulder'
  | 'classic_tops_zones'
  | 'league_points'
  | 'max_height';

export { ok, err } from './result';
export type { Result } from './result';
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

export interface ScoringError {
  format: ScoringFormat;
  message: string;
}

export type ScoringStrategyFn = (
  attempts: Attempt[],
  config: RoundScoringConfig,
) => Result<RankedResult[], ScoringError>;
```

The per-format *algorithm* function (e.g. `scoreClassicTopsZones`) stays a
plain, total, pure function returning `ClassicTopsZonesResult[]` directly —
it has no failure mode of its own, so wrapping it in `Result` would be
ceremony with no payoff. The `Result` wrapping happens one layer up, in the
registry, which is where the one real failure mode lives ("this format
isn't implemented yet").

```ts
// packages/scoring/src/registry.ts
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
   - `topAttempts` = sum, over problems actually topped, of `topAttempts ??
     1` (a top can't happen in zero attempts, so a judge row that recorded
     `top: true` without a count defaults to the best case — 1 — rather
     than letting a missing count silently outrank someone who legitimately
     flashed the problem).
   - **Topping a problem always counts its zone too** (`zone: true` **or**
     `top: true`) — climbing a problem to the top necessarily passes the
     zone hold on the way, so this holds regardless of whether the judge UI
     also set `zone: true` on that row. `zoneAttempts` sums the same way as
     `topAttempts` (defaulting a missing count to `1`) over every problem
     credited with a zone by this rule.
5. Sort by: `tops` desc → `topAttempts` asc → `zones` desc → `zoneAttempts`
   asc.
6. Assign standard competition ranking: identical stats on all four fields
   → same `rank`, `tied: true` for every member of that group; the next
   distinct rank skips ahead by the group size (1, 1, 3, 4...).

## Stub strategies

`ifsc_boulder`, `league_points`, `max_height` each return `err({ format,
message })` via the shared `notImplemented(format)` helper, so a caller
can't mistake "not implemented" (an `ok: false` result they must check) for
"nobody scored" (an empty `ok: true` array). Not modeled as a custom error
class hierarchy — one flat `ScoringError` shape covers the only error case
that exists today.

## Error handling

- Unknown `ScoringFormat` string reaching `scoreRound` can't happen at the
  type level (the union is exhaustive) — no runtime "unknown format" branch
  needed.
- Stub formats return `{ ok: false, error }` synchronously; it's the
  caller's job (future slice) to decide how that surfaces in the UI — e.g.
  render "formato de puntaje no disponible" instead of a table. Not this
  slice's concern.

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
- Each of the 3 stub strategies returns `{ ok: false, error }` (with the
  right `format`/`message`) when called via `scoreRound`; `classic_tops_
  zones` returns `{ ok: true, value: [...] }`.
- `packages/core`'s new `result.ts` gets a minimal test for `ok`/`err`
  (CLAUDE.md requires tests in `packages/core` unconditionally, even for a
  two-line helper).

## Explicitly deferred out of this slice

- Implementing `ifsc_boulder`, `league_points`, `max_height` — each gets its
  own design/spec when it's the one a real event needs, same one-at-a-time
  pattern as this slice.
- Wiring `scoreRound()` into any route (leaderboard, judge capture, event
  history).
- Caching or recomputation-on-write strategy for the public leaderboard
  (domain decision #4) — irrelevant until something calls `scoreRound` from
  a request path.
