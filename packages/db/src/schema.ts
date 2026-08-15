import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  bigserial,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

// 'speed' deferred: attempts has no time-capture column yet, so a speed
// event would be selectable but unscoreable. Re-add when speed scoring
// (and a time/lane column on attempts) exists.
export const disciplineEnum = pgEnum('discipline', ['boulder', 'lead']);
export const roundTypeEnum = pgEnum('round_type', [
  'qualification',
  'semifinal',
  'final',
]);
export const genderEnum = pgEnum('gender', ['male', 'female', 'mixed']);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id),
  name: text('name').notNull(),
  location: text('location').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id),
  name: text('name').notNull(),
  discipline: disciplineEnum('discipline').notNull(),
  scoringFormat: text('scoring_format').notNull(),
  slug: text('slug').notNull().unique(),
  // Shared secret a judge types once per device before capturing. Null means
  // the event predates this column and stays open — the check only applies
  // when the organizer set a code.
  judgeCode: text('judge_code'),
  timezone: text('timezone').notNull(),
  date: date('date'),
  // Último día que acepta inscripciones, en la zona del evento. Null = abierto
  // hasta que el organizador ponga una fecha, que es como quedaron los eventos
  // creados antes de que esta columna existiera.
  registrationDeadline: date('registration_deadline'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id),
  name: text('name').notNull(),
  gender: genderEnum('gender'),
  minAge: integer('min_age'),
  maxAge: integer('max_age'),
  level: text('level'),
});

export const rounds = pgTable('rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  type: roundTypeEnum('type').notNull(),
  order: integer('order').notNull(),
  // Cuántos pasan de esta ronda a la siguiente. La ronda que sigue se corre
  // solo con ellos: sin esto, una final se dibujaba con toda la categoría y los
  // que no clasificaron salían en la tabla con casillas vacías.
  //
  // Null es "pasan todos", que es como se comportaban los eventos creados antes
  // de esta columna y lo correcto en un evento de una sola ronda.
  advances: integer('advances'),
});

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

export const athletes = pgTable('athletes', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  documentId: text('document_id').unique(),
  birthDate: date('birth_date'),
  gender: genderEnum('gender'),
});

export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    athleteId: uuid('athlete_id')
      .notNull()
      .references(() => athletes.id),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    bibNumber: text('bib_number'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Una inscripción por atleta y evento, no por categoría. Con la restricción
  // por categoría, la misma persona podía inscribirse en Masculino Intermedio y
  // volver a entrar al enlace para inscribirse también en Avanzado: las dos
  // pasaban y salía dos veces en el listado. Por evento es más fuerte y absorbe
  // a la anterior — dos filas en la misma categoría también son dos en el mismo
  // evento. Va en la base y no solo en el código porque dos envíos simultáneos
  // se cuelan por cualquier comprobación previa.
  (table) => [unique().on(table.athleteId, table.eventId)],
);

// The newest attempt for a (registrationId, problemId) pair — i.e. the one a
// correction supersedes — is the row with the highest `sequence`, not the
// highest capturedAt/createdAt. capturedAt is a judge's device clock (can be
// wrong or unsynced); createdAt uses Postgres now(), which is frozen for the
// whole transaction, so a correction inserted alongside the row it fixes can
// share an identical createdAt. `sequence` (bigserial) is strictly increasing
// per row regardless of transaction timing.
export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sequence: bigserial('sequence', { mode: 'number' }),
  clientAttemptId: uuid('client_attempt_id').notNull().unique(),
  registrationId: uuid('registration_id')
    .notNull()
    .references(() => registrations.id),
  problemId: uuid('problem_id')
    .notNull()
    .references(() => problems.id),
  judgeLabel: text('judge_label').notNull(),
  top: boolean('top').notNull(),
  topAttempts: integer('top_attempts'),
  zone: boolean('zone').notNull(),
  zoneAttempts: integer('zone_attempts'),
  height: numeric('height', { mode: 'number' }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invitación de un solo uso para crear cuenta de organizador. Reemplaza el
// secreto único y reutilizable que vivía en ORGANIZER_ACCESS_CODE: ahí, quien
// consiguiera la cadena podía abrir cuentas indefinidamente. Aquí el código
// muere al usarse, y `usedBy` deja el rastro de con cuál invitación entró cada
// organizador.
export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  usedAt: timestamp('used_at', { withTimezone: true }),
  usedBy: text('used_by').references(() => user.id),
});
