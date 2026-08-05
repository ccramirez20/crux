# Organizer Authentication — Design

Prerequisite slice before the "create event" screen. Wires up Better Auth (already
named in `CLAUDE.md`'s stack, not yet integrated) so `(organizer)/` pages can be
protected and events can have an owner.

## Goal

Let a gated set of people (organizers/judges) log in, and make sure an event can
only be created or edited by the account that owns it — while still letting any
logged-in account *see* the full events list. Athletes registering for a competition
are unaffected: that stays a separate, accountless public form (decision #5), out of
scope here.

## Sign-up gating

Stage 1 explicitly excludes "múltiples organizaciones con roles," so this is not a
roles system — it's a single gate on account creation. `emailAndPassword` sign-up is
open at the route level, but a Better Auth `before` hook on `/sign-up/email` checks a
submitted `accessCode` field against `process.env.ORGANIZER_ACCESS_CODE` and rejects
the request (`APIError('BAD_REQUEST', ...)`) if it doesn't match. Anyone with the
code can self-serve a new organizer/judge account; anyone without it cannot sign up
at all. No invite-token table, no email verification flow — both would be more
machinery than a single shared secret needs at this scale.

## Event ownership and visibility

- `events` gets one new column: `ownerId` (text, not null, references the new
  `user.id` table Better Auth generates).
- **Visibility:** any logged-in account can see the full events list — useful since
  you and a co-organizer both need to see what's running.
- **Management:** creating a new event sets `ownerId` to the creator. Editing or
  deleting an event is only permitted when the current session's user id matches
  `events.ownerId`. This is enforced in the server actions/route handlers that
  mutate events (not a DB-level policy) — Postgres RLS is more machinery than a
  single-table ownership check needs right now.

## Architecture

- **`apps/web/lib/auth.ts`** — Better Auth server instance:
  `drizzleAdapter(db, { provider: 'pg' })`, `emailAndPassword: { enabled: true }`,
  and the sign-up gating hook described above.
- **`apps/web/lib/auth-client.ts`** — `createAuthClient()`, used by the sign-in/
  sign-up forms and any client component that needs `useSession()`.
- **`apps/web/app/api/auth/[...all]/route.ts`** — the one route handler Better Auth
  needs, via `toNextJsHandler` from `better-auth/next-js`.
- **`apps/web/app/sign-in/page.tsx`, `apps/web/app/sign-up/page.tsx`** — plain forms
  (email, password; sign-up also collects the access code). Live outside both
  `(public)` and `(organizer)` — they're neither the public results view nor a
  protected organizer page.
- **`apps/web/app/(organizer)/layout.tsx`** — server component that calls
  `auth.api.getSession({ headers: await headers() })` and redirects to `/sign-in`
  when there's no session. This is the single choke point that protects every page
  under `(organizer)/`, including the create-event screen that follows this slice.

## Schema change (needs explicit sign-off — this is new DB schema)

- Better Auth's own tables (`user`, `session`, `account`, `verification`), generated
  via its CLI directly into `packages/db`, migrated the normal way with
  `pnpm db:generate`.
- `events.ownerId` (text, not null) — references `user.id`.

## New dependency (needs approval)

- `better-auth` — already named in `CLAUDE.md`'s Stack section, so this is a
  formality, not a surprise addition.

## Explicitly deferred out of this slice

- No roles/permissions table — a second real gym is what would justify one.
- No email verification / password reset flow — `sendResetPassword` needs a working
  transactional email setup, which doesn't exist yet.
- No automated test suite for `apps/web` (it currently has none — `echo 'sin tests
  todavia'`). Verification for this slice is manual: sign up with and without the
  correct access code, sign in, confirm `(organizer)/` redirects to `/sign-in` when
  logged out. Playwright is in the project's stated stack for e2e later, but standing
  it up is a bigger lift than this slice needs.
- The create-event screen itself — separate slice, built on top of this one.

## Environment variables

New entries for `apps/web/.env.example`:
- `BETTER_AUTH_SECRET` — session signing secret.
- `BETTER_AUTH_URL` — base URL (e.g. `http://localhost:3000` in dev).
- `ORGANIZER_ACCESS_CODE` — the shared sign-up gate value.

## Follow-up (last task in the implementation plan, not part of this design)

Once this slice ships, audit `CLAUDE.md` and `docs/*.md` against actual repo state:
stale references, missing structure notes, anything that would waste tokens or
mislead a future session on prompting practices, harness setup, testing conventions,
or dev workflow.
