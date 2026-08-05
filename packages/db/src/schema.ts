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
} from 'drizzle-orm/pg-core';

export const disciplineEnum = pgEnum('discipline', ['boulder', 'lead', 'speed']);
export const roundTypeEnum = pgEnum('round_type', [
  'qualification',
  'semifinal',
  'final',
]);
export const genderEnum = pgEnum('gender', ['male', 'female', 'mixed']);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  discipline: disciplineEnum('discipline').notNull(),
  scoringFormat: text('scoring_format').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull(),
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
});

export const problems = pgTable('problems', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id')
    .notNull()
    .references(() => rounds.id),
  number: integer('number').notNull(),
  name: text('name'),
});

export const athletes = pgTable('athletes', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  documentId: text('document_id'),
  birthDate: date('birth_date'),
  gender: genderEnum('gender'),
});

export const registrations = pgTable('registrations', {
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
});

export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
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
