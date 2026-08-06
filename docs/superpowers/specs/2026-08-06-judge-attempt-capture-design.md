# Judge Attempt Capture (Offline-First) + Block QR Codes — Design

Closes the last major gap in etapa 1's scope table: "Los jueces capturan
intentos desde el teléfono," and its non-negotiable domain decision #3
("La captura de jueces es offline-first"). Everything a judge writes lands
in the already-existing `attempts` table — no schema change ships with this
slice; `clientAttemptId`, `sequence`, and every scoreable field were built
for this in the domain-schema slice, just never had a writer.

## Goal

A judge opens a link on their phone — no login, matching domain decision #5
and the existing accountless `/inscripcion/[slug]` pattern — picks (or
arrives pre-scoped to, via QR) a block, enters an athlete's bib number, and
records top/zone/attempts (boulder) or height (lead). It works when wifi
drops mid-capture: the write survives in the browser, syncs when the
network comes back, and never double-counts a synced-twice attempt.
Organizers get a printable QR per block that jumps a judge straight into
that block's capture screen.

## Flow

### Judge

1. Judge opens `/juzgar/[slug]` (free navigation: picks categoría → ronda →
   bloque) or `/juzgar/[slug]/[problemId]` (from a scanned QR: that block is
   pre-selected, equivalent to picking it by hand — nothing else differs
   between the two entry points once the page has loaded).
2. First thing on the page (before any block is picked): a name prompt for
   `judgeLabel`, stored in `localStorage` (not IndexedDB — this is a small
   string read synchronously on load, not a queue) so it isn't asked again
   on that device. A small "cambiar nombre" control lets a judge who hands
   their phone to someone else fix it. Every attempt this session uses the
   stored name; there's no per-attempt "who are you" prompt.
4. Page loads once, with whatever connectivity is available at that moment:
   the event's categories/rounds/problems and each round's registrations
   (`athleteId`, `bibNumber`, `fullName`) are fetched and kept in the page's
   React state for the rest of the session. This reference data is **not**
   persisted to IndexedDB — domain decision #3 requires the *write* path
   (attempts) to survive offline, not the read path. A judge who force-quits
   the tab with zero signal needs to wait for signal to reopen it; a judge
   who loses signal mid-session keeps capturing normally, since the
   reference data is already in memory.
5. Judge types a bib number. The already-loaded registrations resolve it to
   a `registrationId` (and confirm it belongs to a category whose round
   contains the selected block — a bib from the wrong category is rejected
   client-side with a message, before ever touching the network).
6. Form fields depend on the event's `discipline`:
   - `boulder`: top (yes/no), attempts-to-top, zone (yes/no),
     attempts-to-zone.
   - `lead`: height reached.
7. On submit: a `clientAttemptId` (UUID, generated client-side) and
   `capturedAt` (device clock, purely informational per the schema's
   existing comment — never used to order corrections) are attached, and
   the record is written to an IndexedDB queue immediately. The UI shows it
   right away in the block's "últimos intentos" list, tagged "sin
   sincronizar" until the server confirms it.
8. A background loop (see Offline/Sync below) drains the queue to the
   server. Once the server acknowledges a given `clientAttemptId`, its
   "sin sincronizar" tag clears.
9. **Correction:** tapping any entry in "últimos intentos" (synced or not)
   pre-fills the form with that entry's values. Submitting creates a *new*
   attempt row (new `clientAttemptId`) for the same
   `(registrationId, problemId)` — never a PATCH. Once synced, its higher
   `sequence` makes it the current one for scoring, per the existing
   `resolveCurrentAttempts` rule already shipped in `packages/scoring`.

### Organizer (QR)

1. On the event detail page (`(organizer)/panel/events/[id]`), each problem
   row gets a "Ver QR" affordance.
2. Clicking it renders a QR code (generated client-side, `qrcode` package)
   encoding the absolute URL `/juzgar/[event.slug]/[problem.id]`. The
   organizer can screenshot/print it and post it at that block.

## Architecture

**New route group `apps/web/app/(judge)/`** (public, no auth — same
posture as `(public)/inscripcion`):

- `juzgar/[slug]/page.tsx` — server component. Loads the event by slug
  (`notFound()` if missing), then its categories → rounds → problems →
  registrations (bib numbers), same nested-select shape
  `(organizer)/panel/events/[id]/page.tsx` already uses. Renders
  `<CaptureApp>` with no locked block.
- `juzgar/[slug]/[problemId]/page.tsx` — same data load, plus validates
  `problemId` belongs to this event (404 if not — a stale or tampered QR
  shouldn't silently drop into an unrelated event's capture screen).
  Renders `<CaptureApp lockedProblemId={problemId} />`.
- `juzgar/[slug]/capture-app.tsx` — `'use client'`. Owns: the
  category/round/problem picker (skipped entirely when `lockedProblemId` is
  set — shows the block's name/number instead, with an "cambiar de bloque"
  escape hatch that drops back to free navigation within the same loaded
  session), the bib-number input and its client-side resolution against the
  loaded registrations, the discipline-conditional form, the "últimos
  intentos" list (merges server-loaded attempts for the active block with
  whatever's still in the local IndexedDB queue, deduped by
  `clientAttemptId`, newest first), and the sync-status indicator ("N sin
  sincronizar" / "todo sincronizado").
- `juzgar/[slug]/attempt-queue.ts` — the IndexedDB wrapper (native API, no
  new dependency — a single object store keyed by `clientAttemptId`, plus
  `addPending`, `listPending`, `removeSynced`). Framework-agnostic, so it's
  testable without mounting React.

**New API route** `apps/web/app/api/attempts/route.ts` (`POST`), the sync
target — a route handler, not a server action, because the offline queue
drains via plain `fetch` from a background loop that isn't tied to a form
submission or an active React tree:

- Body: one attempt (`clientAttemptId`, `registrationId`, `problemId`,
  `judgeLabel`, `top`, `topAttempts`, `zone`, `zoneAttempts`, `height`,
  `capturedAt`) — Zod-validated (CLAUDE.md: Zod on every input boundary).
- No auth check (matches the judge link being accountless — same posture as
  `registerAthlete`).
- Validates `registrationId`/`problemId` exist and belong to the same
  round/category chain (defense against a malformed or tampered payload —
  not a security boundary against a determined attacker, same bar as the
  rest of etapa 1's public write endpoints).
- Inserts into `attempts`. On a `clientAttemptId` unique-violation, treats
  it as success (idempotent re-delivery, not an error) — this is the exact
  mechanism domain decision #3 calls for ("Endpoint idempotente por
  clientAttemptId").
- Returns `{ ok: true }` / `{ ok: false, error }`, same shape as every
  server action in the app, for the client queue to know whether to drop
  the item (`ok: true`, including the idempotent-replay case) or keep
  retrying (network failure, 5xx).

**Shared helper extraction:** `isUniqueViolation` (detects Postgres error
code `23505`, including Drizzle's `.cause`-wrapped form) is currently
duplicated across `(public)/inscripcion/[slug]/actions.ts` and
`(organizer)/panel/events/new/actions.ts` with two slightly different
implementations. This route needs the same check a third time — past
CLAUDE.md's "≥3 uses" bar — so it moves to `apps/web/lib/db-errors.ts` and
all three call sites import it from there.

**Organizer QR:** `problem-qr.tsx` (client component, colocated with
`problem-form.tsx`), rendered next to each problem row in
`event-structure.tsx`. Calls `qrcode`'s browser-safe `toDataURL()` on the
computed URL and shows the result as an `<img>` inside a small
toggle/popover — no server round-trip, no new API route needed just for
image generation.

## Offline / Sync mechanics

- **Storage:** one IndexedDB database, one object store
  (`pendingAttempts`), keyed by `clientAttemptId`. Chosen over
  `localStorage` because attempt payloads are structured objects and the
  queue needs to be listed/removed by key — exactly IndexedDB's job, and
  native (no new dependency, per the ponytail/YAGNI call already made for
  this piece).
- **Enqueue:** happens synchronously in the submit handler, before any
  network attempt — the UI never waits on connectivity to acknowledge a
  capture.
- **Drain loop:** a `setInterval` (5s, matching the polling cadence domain
  decision #4 already established for the leaderboard — one convention for
  "how often does this app poll," not a new one) that, while the queue is
  non-empty, sends its items to `POST /api/attempts` **one at a time,
  awaiting each response before sending the next**. This ordering is not
  incidental: `attempts.sequence` is a server-assigned `bigserial` and is
  the *only* trusted correction tiebreak (the schema's own comment explains
  why — device clocks can't be trusted). If two queued items for the same
  block synced concurrently or out of order, a correction could receive a
  *lower* sequence than the mistake it was meant to supersede. Serial,
  in-order draining is what makes capture order and sequence order match.
  Not driven by `window`'s `online`/`offline` events (unreliable — a device
  can report "online" while the specific request still fails); a failed
  request just leaves the item queued for the next tick.
- **Removal:** an item leaves the IndexedDB queue only after its POST
  returns `{ ok: true }` (including the idempotent-duplicate case).
- **Multi-judge safety:** two judges on different phones capturing the same
  `(registrationId, problemId)` need no coordination — each attempt is its
  own row with its own server-assigned `sequence`; "which one counts" is
  already `packages/scoring`'s job (highest `sequence` wins), unchanged by
  this slice.

## Error handling

- Unknown event `slug` → `notFound()` (matches `/inscripcion/[slug]`).
- `problemId` in the URL that doesn't belong to the event → `notFound()`.
- Bib number that doesn't resolve to a registration in scope → inline
  message, no network call.
- `POST /api/attempts` payload failing Zod → `{ ok: false, error: '...' }`,
  4xx — the client logs it and drops the item (a malformed payload will
  never succeed by retrying; surfacing a stuck "sin sincronizar" forever
  would be worse than losing that one entry, and this is a client bug, not
  a network condition, if it ever fires).
- `POST /api/attempts` succeeding on a `clientAttemptId` already in the
  table → still `{ ok: true }` (idempotent).
- Network failure / 5xx → item stays queued, retried next tick, no user
  action required beyond having signal eventually.

## Testing

`apps/web` still has no test runner wired up — this slice does not change
that. `attempt-queue.ts` has real logic (`addPending`/`listPending`/
`removeSynced`) that would benefit from a unit test, but standing up a test
runner for `apps/web` is a repo-wide infrastructure decision bigger than
one feature and out of scope here — same bar CLAUDE.md already sets
("`pnpm test:e2e` no ejecuta nada todavía"). This ships with the same
manual-verification bar every prior `apps/web` slice has used.

Manual verification path: load `/juzgar/[slug]` with network, capture an
attempt, kill network, capture two more (see them appear locally, tagged
unsynced), restore network, confirm all three sync within one 5s tick and
the tags clear; scan a block's QR and confirm it lands pre-locked; submit a
correction and query `attempts` directly to confirm the new row has a
higher `sequence` than the one it corrected (there's no leaderboard yet to
watch update — that's the deferred wiring below — but the already-tested
`resolveCurrentAttempts` rule guarantees the higher-`sequence` row is what
`packages/scoring` will pick up once it is).

## Explicitly deferred out of this slice

- Wiring the public leaderboard to `scoreRound()` — still a separate slice
  per the previous two specs' deferrals; this slice only adds a writer for
  `attempts`, not a reader.
- Any judge-facing view of computed scores/rankings — a judge captures
  attempts, they don't see standings.
- Rate limiting or bot protection on `POST /api/attempts` — same posture as
  every other public write endpoint in etapa 1.
- Reassigning or editing `bibNumber` from the judge screen — that's the
  organizer's panel, unchanged.
- Caching reference data (rounds/problems/registrations) in IndexedDB for a
  cold start with zero prior signal — explicitly out of scope per the
  product decision above; only the write queue is offline-resilient.
- A "juez" account/role — the link itself is the access control, matching
  domain decision #5 and the existing auth design's explicit "no roles
  system" call.
