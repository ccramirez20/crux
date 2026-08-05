# Stage 1 Domain Schema — Design

Closes the placeholder left in `packages/db/src/schema.ts` ("Tablas Drizzle llegan con
el issue #3") and the stub `packages/core/src/index.ts`. Covers the seven entities
named in that placeholder: `Event`, `Category`, `Round`, `Problem`, `Athlete`,
`Registration`, `Attempt`, plus a minimal `Organization` since `Event` belongs to one
per `CLAUDE.md`'s domain glossary.

## Goal

Give `apps/web` a real, queryable domain model for stage 1 (inscripciones, categorías,
captura de intentos) and give `packages/core` the pure types that mirror it, so
`packages/scoring` has something to consume once it's built. No scoring strategies,
no auth wiring, no leaderboard computation in this slice — those are separate.

## Entities

### `organizations`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | |
| createdAt | timestamptz | |

No roles, no multi-org membership model — out of scope for stage 1 per `CLAUDE.md`.

### `events`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organizationId | uuid fk → organizations.id | |
| name | text | |
| discipline | enum: `boulder`\|`lead` | one discipline per event |
| scoringFormat | text | identifier consumed later by `packages/scoring`'s registry; not validated against anything yet |
| slug | text, unique | public inscription link |
| timezone | text | IANA name, e.g. `America/Bogota` — CLAUDE.md requires each event to own its timezone |
| createdAt | timestamptz | |

Deliberately no `status`/`published` column. The slug is unguessable until the
organizer shares it — that's sufficient gating for stage 1. Add a real publish state
when organizers need to close registration independent of link secrecy.

### `categories`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| eventId | uuid fk → events.id | |
| name | text | |
| gender | enum: `male`\|`female`\|`mixed`, nullable | |
| minAge | int, nullable | |
| maxAge | int, nullable | |
| level | text, nullable | |

Structured age/gender/level fields because `CLAUDE.md`'s own glossary defines
Category as "edad + género + nivel" — not a speculative abstraction. Nothing
enforces eligibility against these yet; that's a later slice.

### `rounds`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| categoryId | uuid fk → categories.id | rounds belong to a category, not directly to the event — each category runs its own qualifier→semi→final |
| type | enum: `qualification`\|`semifinal`\|`final` | |
| order | int | for display/progression ordering |

### `problems`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| roundId | uuid fk → rounds.id | |
| number | int | |
| name | text, nullable | |

No point-value columns — per-problem scoring weight is a `packages/scoring` concern,
not storage.

### `athletes`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| fullName | text | |
| documentId | text, nullable | |
| birthDate | date, nullable | |
| gender | enum: `male`\|`female`\|`mixed`, nullable | |

No `userId` link. Decision #5 says Athlete/User are "linkable later," but there is no
`User` table to link to until Better Auth is wired up — adding the column now would
be dead weight with nothing to point at.

### `registrations`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| athleteId | uuid fk → athletes.id | |
| eventId | uuid fk → events.id | |
| categoryId | uuid fk → categories.id | |
| bibNumber | text, nullable | |
| createdAt | timestamptz | |

Both `eventId` and `categoryId` are stored even though `categoryId` implies the
event, matching the domain glossary's literal definition ("Athlete + Event +
Category") and avoiding a join on the hot leaderboard-read path.

A composite `unique(athleteId, categoryId)` constraint prevents double-registering
the same athlete in the same category, which would otherwise produce a duplicate
row for that athlete on the leaderboard.

### `attempts`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| sequence | bigserial | monotonic correction tiebreak — see "Corrections" below |
| clientAttemptId | uuid, unique | idempotency key generated client-side (decision #3) |
| registrationId | uuid fk → registrations.id | |
| problemId | uuid fk → problems.id | |
| judgeLabel | text | free text / device identifier — no FK, auth isn't wired up yet |
| top | boolean | |
| topAttempts | int, nullable | |
| zone | boolean | |
| zoneAttempts | int, nullable | |
| height | numeric, nullable | lead discipline only |
| capturedAt | timestamptz | when the judge captured it on-device (may predate server insert due to offline queue) |
| createdAt | timestamptz | server insert time |

Append-only. No update, no delete, matches decision #1 (attempts are the fact,
scores are derived).

## Corrections: implicit-by-recency, not an explicit chain

Decision #1 requires that correcting a judge's mistake means inserting a new row, not
editing one. Two ways to make "which row is current" resolvable:

- **A — explicit chain:** each correcting row carries `supersedesAttemptId` pointing
  at the row it fixes.
- **B — implicit by recency (chosen):** no link. Whoever computes the leaderboard
  takes the `attempts` row with the highest `sequence` per `(registrationId,
  problemId)`. Older rows stay in the table as history but are ignored by scoring.
  `sequence` (a `bigserial`), not `capturedAt`/`createdAt`, is the actual ordering
  column: `capturedAt` is a judge's device clock, and `createdAt` uses Postgres
  `now()`, which is frozen for the whole transaction, so a correction inserted
  alongside the row it fixes can share an identical `createdAt`.

B is the full audit trail CLAUDE.md asks for — nothing is destroyed, everything is
queryable — without a linkage system nobody has asked for yet. Upgrade to A only if
the product needs to show *why* something was corrected, not just what the current
value is.

## `packages/core` types

Pure types mirroring the tables above, no IO, no Drizzle imports:

- `Discipline = 'boulder' | 'lead'` (`speed` deferred — see below)
- `RoundType = 'qualification' | 'semifinal' | 'final'`
- `Gender = 'male' | 'female' | 'mixed'`
- `ScoringFormat = string` (branded/opaque for now — `packages/scoring` owns the real
  registry of valid values; `core` just names the type so `Event.scoringFormat` isn't
  a bare `string` everywhere it's threaded through)
- `Attempt` — plain object shape matching the `attempts` table, used as the input
  type for `packages/scoring`'s future `score(attempts, config) → RankedResult[]`

## Explicitly deferred out of this slice

- Judge identity as a real FK — needs Better Auth wired up first
- `packages/scoring` strategy implementations — `Event.scoringFormat` exists as a
  field but nothing reads it yet
- Category eligibility enforcement against age/gender/level
- Event publish/draft state
- `speed` discipline — `attempts` has no time-capture column yet; re-add the enum
  value alongside a speed scoring strategy.

## Testing

`packages/db` gets a schema smoke test (drizzle-kit can generate a migration from
`schema.ts` without error) alongside the existing `client.test.ts`. `packages/core`
gets no logic yet — it's types only, nothing to unit test until a function exists.
