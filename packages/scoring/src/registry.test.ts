import { describe, expect, it } from 'vitest';
import type { Attempt } from '@crux/core';
import { scoreRound } from './registry';

const EMPTY_CONFIG = { problemIds: [], registrationIds: [] };
const NO_ATTEMPTS: Attempt[] = [];

describe('scoreRound', () => {
  it.each([
    'classic_tops_zones',
    'ifsc_boulder',
    'league_points',
    'max_height',
  ] as const)('dispatches "%s" and returns an ok result with an empty ranking', (format) => {
    const result = scoreRound(format, NO_ATTEMPTS, EMPTY_CONFIG);
    expect(result).toEqual({ ok: true, value: [] });
  });
});
