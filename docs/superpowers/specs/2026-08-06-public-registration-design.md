# Public Registration — Design

Closes the last gap named in etapa 1's scope table: "Publica un enlace de inscripción."
The organizer already creates events, categories, rounds, and problems
(`(organizer)/panel/events/[id]`); this slice lets an athlete self-register into one
of those categories through a public, accountless link, matching domain decision #5
(`Athlete` and `User` are distinct — the organizer's session has no bearing on who can
register).

## Goal

Given an event's `slug`, anyone can open `/inscripcion/[slug]`, fill a form, and end
up with a `Registration` row tying them to one category of that event. No sign-in, no
publish step, no payment. The athlete is matched by `documentId` so someone who
registers for a second event (or a second category) doesn't get a duplicate `athletes`
row — that's what makes "historial por competidor" (CLAUDE.md) possible later.

## Flow

1. Athlete opens `/inscripcion/[slug]`. Page loads the event by `slug` and all its
   categories. If the event doesn't exist → 404. If it has zero categories yet →
   render "inscripciones aún no disponibles" instead of an empty form.
2. Form asks for full name, document id, birth date, and gender first. As soon as
   birth date + gender are filled, the category list filters client-side to only
   categories whose `minAge`/`maxAge`/`gender` match — ineligible categories aren't
   selectable. `category.gender === null` and `category.gender === 'mixed'` both mean
   "open to any gender" for this filter — `null` is simply a category that never had
   a gender restriction set, `'mixed'` is one explicitly marked open; they behave
   identically here. A category with no age bounds (`minAge`/`maxAge` both null)
   matches any age.
3. Athlete picks one eligible category and submits.
4. Server action:
   - Looks up `athletes` by `documentId`. Reuses the row if found; otherwise inserts
     a new one from the submitted name/document/birthdate/gender.
   - Inserts into `registrations` (`athleteId`, `categoryId`). `bibNumber` stays
     `null` — the organizer assigns it later, not the athlete.
   - The existing unique constraint on `(athleteId, categoryId)` is what catches a
     repeat submission; the action catches that specific DB error and returns "ya
     estás inscrito en esta categoría" instead of a generic failure.
5. Success renders a confirmation ("quedaste inscrito en <categoría>") — no email, no
   redirect elsewhere. Etapa 1 explicitly excludes notifications.

Registering into a second category is a second visit to the same form/submit — not a
multi-select in one submission. Keeps the server action doing one insert per call,
same shape as everything else already in the codebase (`category-form.tsx`,
`round-form.tsx`, `problem-form.tsx` are all one-thing-per-submit).

## Architecture

- **`apps/web/app/(public)/inscripcion/[slug]/page.tsx`** — server component. Loads
  the event by `slug` (`eq(events.slug, slug)`) and its categories, same query shape
  `(organizer)/panel/events/[id]/page.tsx` already uses for categories (minus rounds/
  problems — the public form doesn't need them). Renders the form component or the
  "aún no disponibles" state.
- **`apps/web/app/(public)/inscripcion/[slug]/registration-form.tsx`** — client
  component. Holds form state, filters eligible categories from birthdate/gender
  client-side (pure function, no request), calls the server action on submit, shows
  the success/duplicate/error state inline. Mirrors the `'use client'` + local
  `useState` pattern already used in `create-event-form.tsx`.
- **`apps/web/app/(public)/inscripcion/[slug]/actions.ts`** — the server action
  described above (`'use server'`), same file-next-to-page convention as every other
  route under `(organizer)/panel`.
- **Eligibility check** — a pure function (`isEligible(category, birthDate, gender)`)
  colocated in `registration-form.tsx` since it's UI filtering logic, not domain
  scoring logic; it doesn't belong in `packages/core` (no IO either way, but it's a
  one-off form concern, not a reusable domain rule with three call sites).

## Data model

No schema changes. Everything needed —`events.slug`, `categories.{gender,minAge,
maxAge}`, `athletes.documentId`, the `registrations` unique constraint — already
exists.

## Error handling

- Unknown slug → Next.js `notFound()`.
- Event with no categories → static message, no form rendered.
- Submitted birthdate/gender don't match any category → category list is empty;
  message: "no hay categorías disponibles para tu edad/género en este evento."
- Duplicate `(athleteId, categoryId)` → caught Postgres unique-violation, friendly
  message, not a 500.
- All other insert failures → generic "no se pudo completar la inscripción, intenta
  de nuevo" — same bar as the existing panel server actions, none of which have
  bespoke error taxonomies yet.

## Testing

`isEligible()` is a pure function with real edge cases (no age bounds, only
`minAge`, only `maxAge`, `gender: null` meaning open, exact boundary ages) — gets a
Vitest unit test, same bar CLAUDE.md sets for `packages/core`/`packages/scoring` even
though this one lives in `apps/web` since it's UI-only filtering. Everything else
(the page, the form, the server action) is verified manually: register with a valid
combination, attempt a duplicate, attempt an out-of-range category (shouldn't even be
selectable), submit with zero categories on the event. `apps/web` still has no
automated test runner wired up (per the auth design's deferral) — not changing that
here.

## Explicitly deferred out of this slice

- No capacity limits per category.
- No editing or cancelling an existing registration.
- No email confirmation (etapa 1 excludes notifications).
- No "publish/open registration" toggle on `events` — link is live as soon as the
  event has at least one category (see design Q&A: schema change rejected as
  unnecessary for this slice).
- No bulk/manual registration by the organizer from inside the panel — only the
  public accountless form. Revisit if a gym asks for door-side manual entry.
- No merge tool for two `athletes` rows that turn out to be the same person under a
  typo'd document id — dedupe is exact-match only.
