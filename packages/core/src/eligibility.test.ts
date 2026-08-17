import { describe, expect, it } from 'vitest';
import { isEligible, isMinor, parseDateOnly, type EligibilityCategory } from './eligibility';

const TODAY = new Date(2026, 7, 6); // 2026-08-06, fixed so age math isn't flaky

const OPEN: EligibilityCategory = { gender: null, minAge: null, maxAge: null };

describe('isEligible', () => {
  it('accepts any age and gender when the category has no restrictions', () => {
    expect(isEligible(OPEN, parseDateOnly('1990-01-01'), 'male', TODAY)).toBe(true);
    expect(isEligible(OPEN, parseDateOnly('2020-01-01'), 'female', TODAY)).toBe(true);
  });

  it('rejects a gender that does not match a gender-restricted category', () => {
    const category: EligibilityCategory = { gender: 'female', minAge: null, maxAge: null };
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'male', TODAY)).toBe(false);
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'female', TODAY)).toBe(true);
  });

  it('treats a "mixed" category as open to any gender, same as null', () => {
    const category: EligibilityCategory = { gender: 'mixed', minAge: null, maxAge: null };
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'male', TODAY)).toBe(true);
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'female', TODAY)).toBe(true);
  });

  it('enforces only minAge when maxAge is unset', () => {
    const category: EligibilityCategory = { gender: null, minAge: 18, maxAge: null };
    expect(isEligible(category, parseDateOnly('2010-01-01'), 'male', TODAY)).toBe(false); // 16
    expect(isEligible(category, parseDateOnly('2000-01-01'), 'male', TODAY)).toBe(true); // 26
  });

  it('enforces only maxAge when minAge is unset', () => {
    const category: EligibilityCategory = { gender: null, minAge: null, maxAge: 17 };
    expect(isEligible(category, parseDateOnly('2000-01-01'), 'male', TODAY)).toBe(false); // 26
    expect(isEligible(category, parseDateOnly('2010-01-01'), 'male', TODAY)).toBe(true); // 16
  });

  it('is exact at the lower age boundary, counting a birthday today as reached', () => {
    const category: EligibilityCategory = { gender: null, minAge: 18, maxAge: null };
    // Turns 18 exactly on TODAY (2026-08-06)
    expect(isEligible(category, parseDateOnly('2008-08-06'), 'male', TODAY)).toBe(true);
    // Turns 18 tomorrow — still 17 today
    expect(isEligible(category, parseDateOnly('2008-08-07'), 'male', TODAY)).toBe(false);
  });

  it('is exact at the upper age boundary', () => {
    const category: EligibilityCategory = { gender: null, minAge: null, maxAge: 17 };
    // Turns 18 today — no longer 17
    expect(isEligible(category, parseDateOnly('2008-08-06'), 'male', TODAY)).toBe(false);
    // Turns 18 tomorrow — still 17 today
    expect(isEligible(category, parseDateOnly('2008-08-07'), 'male', TODAY)).toBe(true);
  });

  it('defaults to the current date when today is omitted', () => {
    const category: EligibilityCategory = { gender: null, minAge: null, maxAge: null };
    expect(isEligible(category, parseDateOnly('1990-01-01'), 'male')).toBe(true);
  });
});

describe('isMinor', () => {
  it('treats a missing birth date as a minor, fail-safe', () => {
    expect(isMinor(null, TODAY)).toBe(true);
  });

  it('is exact at the boundary, counting a birthday today as reached', () => {
    expect(isMinor('2008-08-06', TODAY)).toBe(false); // turns 18 today
    expect(isMinor('2008-08-07', TODAY)).toBe(true); // turns 18 tomorrow
  });

  it('is true for a clear minor and false for a clear adult', () => {
    expect(isMinor('2015-01-01', TODAY)).toBe(true);
    expect(isMinor('1990-01-01', TODAY)).toBe(false);
  });
});

describe('parseDateOnly', () => {
  it('parses year, month, and day as local-time midnight', () => {
    const date = parseDateOnly('2000-03-15');
    expect(date.getFullYear()).toBe(2000);
    expect(date.getMonth()).toBe(2); // 0-indexed
    expect(date.getDate()).toBe(15);
  });
});
