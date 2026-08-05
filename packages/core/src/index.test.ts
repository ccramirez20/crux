import { describe, expect, it } from 'vitest';
import { DISCIPLINES, ROUND_TYPES, GENDERS } from './index';
import type { Attempt } from './index';

describe('domain enums', () => {
  it('lists the three stage 1 disciplines', () => {
    expect(DISCIPLINES).toEqual(['boulder', 'lead']);
  });

  it('lists the three round types', () => {
    expect(ROUND_TYPES).toEqual(['qualification', 'semifinal', 'final']);
  });

  it('lists the three gender categories', () => {
    expect(GENDERS).toEqual(['male', 'female', 'mixed']);
  });
});

describe('Attempt shape', () => {
  it('accepts a fully captured boulder attempt', () => {
    const attempt: Attempt = {
      id: '1',
      sequence: 1,
      clientAttemptId: 'client-1',
      registrationId: 'reg-1',
      problemId: 'problem-1',
      judgeLabel: 'judge-phone-3',
      top: true,
      topAttempts: 2,
      zone: true,
      zoneAttempts: 1,
      height: null,
      capturedAt: new Date('2026-08-05T12:00:00Z'),
      createdAt: new Date('2026-08-05T12:00:01Z'),
    };

    expect(attempt.top).toBe(true);
  });

  it('accepts a lead attempt with no top/zone attempt counts', () => {
    const attempt: Attempt = {
      id: '2',
      sequence: 2,
      clientAttemptId: 'client-2',
      registrationId: 'reg-2',
      problemId: 'problem-2',
      judgeLabel: 'judge-phone-1',
      top: false,
      topAttempts: null,
      zone: false,
      zoneAttempts: null,
      height: 12.5,
      capturedAt: new Date('2026-08-05T12:05:00Z'),
      createdAt: new Date('2026-08-05T12:05:01Z'),
    };

    expect(attempt.height).toBe(12.5);
  });
});
