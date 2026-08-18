import { describe, expect, it } from 'vitest';
import { authorizationSatisfied } from './minor-authorization';

const TODAY = new Date(2026, 7, 6); // 2026-08-06, fixed so age math isn't flaky

describe('authorizationSatisfied', () => {
  it('does not need a name for an adult', () => {
    expect(authorizationSatisfied('1990-01-01', undefined, TODAY)).toBe(true);
    expect(authorizationSatisfied('1990-01-01', null, TODAY)).toBe(true);
  });

  it('rejects a minor with no name, or only whitespace', () => {
    expect(authorizationSatisfied('2015-01-01', undefined, TODAY)).toBe(false);
    expect(authorizationSatisfied('2015-01-01', null, TODAY)).toBe(false);
    expect(authorizationSatisfied('2015-01-01', '   ', TODAY)).toBe(false);
  });

  it('accepts a minor once someone is named', () => {
    expect(authorizationSatisfied('2015-01-01', 'Ana Restrepo', TODAY)).toBe(true);
  });
});
