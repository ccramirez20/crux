import type { Attempt } from '@crux/core';

let attemptCounter = 0;

export function makeAttempt(
  overrides: Partial<Attempt> & Pick<Attempt, 'registrationId' | 'problemId' | 'sequence'>,
): Attempt {
  attemptCounter += 1;
  return {
    id: `attempt-${attemptCounter}`,
    clientAttemptId: `client-${attemptCounter}`,
    judgeLabel: 'judge-1',
    top: false,
    topAttempts: null,
    zone: false,
    zoneAttempts: null,
    height: null,
    capturedAt: new Date('2026-08-06T12:00:00Z'),
    createdAt: new Date('2026-08-06T12:00:00Z'),
    ...overrides,
  };
}
