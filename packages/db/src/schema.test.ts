import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  disciplineEnum,
  roundTypeEnum,
  genderEnum,
  events,
  categories,
  registrations,
  attempts,
  problems,
  athletes,
} from './schema';

describe('enums', () => {
  it('discipline has the three stage 1 disciplines', () => {
    expect(disciplineEnum.enumValues).toEqual(['boulder', 'lead']);
  });

  it('roundType has qualification, semifinal, final', () => {
    expect(roundTypeEnum.enumValues).toEqual([
      'qualification',
      'semifinal',
      'final',
    ]);
  });

  it('gender has male, female, mixed', () => {
    expect(genderEnum.enumValues).toEqual(['male', 'female', 'mixed']);
  });
});

describe('events', () => {
  it('requires organizationId and enforces a unique slug', () => {
    expect(events.organizationId.notNull).toBe(true);
    expect(events.slug.notNull).toBe(true);
    expect(events.slug.isUnique).toBe(true);
  });
});

describe('categories', () => {
  it('makes gender, age range and level optional', () => {
    expect(categories.gender.notNull).toBe(false);
    expect(categories.minAge.notNull).toBe(false);
    expect(categories.maxAge.notNull).toBe(false);
    expect(categories.level.notNull).toBe(false);
  });
});

describe('registrations', () => {
  it('stores both eventId and categoryId', () => {
    expect(registrations.eventId.notNull).toBe(true);
    expect(registrations.categoryId.notNull).toBe(true);
  });

  it('enforces one registration per athlete per category', () => {
    const { uniqueConstraints } = getTableConfig(registrations);
    const columnSets = uniqueConstraints.map((uc) =>
      uc.columns.map((c) => c.name).sort().join(','),
    );
    expect(columnSets).toContain('athlete_id,category_id');
  });
});

describe('attempts', () => {
  it('has a unique, required clientAttemptId for idempotent capture', () => {
    expect(attempts.clientAttemptId.notNull).toBe(true);
    expect(attempts.clientAttemptId.isUnique).toBe(true);
  });

  it('requires top and zone but leaves attempt counts and height optional', () => {
    expect(attempts.top.notNull).toBe(true);
    expect(attempts.zone.notNull).toBe(true);
    expect(attempts.topAttempts.notNull).toBe(false);
    expect(attempts.zoneAttempts.notNull).toBe(false);
    expect(attempts.height.notNull).toBe(false);
  });

  it('has a monotonic sequence column as the correction tiebreak', () => {
    expect(attempts.sequence.notNull).toBe(true);
    expect(attempts.sequence.hasDefault).toBe(true);
  });
});

describe('column naming', () => {
  it('uses snake_case column names in Postgres', () => {
    expect(problems.roundId.name).toBe('round_id');
    expect(athletes.fullName.name).toBe('full_name');
  });
});
