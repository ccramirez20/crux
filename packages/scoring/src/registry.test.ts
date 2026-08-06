import { describe, expect, it } from 'vitest';
import type { Attempt } from '@crux/core';
import { scoreRound } from './registry';

const EMPTY_CONFIG = { problemIds: [], registrationIds: [] };
const NO_ATTEMPTS: Attempt[] = [];

describe('scoreRound', () => {
  it('dispatches classic_tops_zones and returns ok', () => {
    const result = scoreRound('classic_tops_zones', NO_ATTEMPTS, EMPTY_CONFIG);
    expect(result).toEqual({ ok: true, value: [] });
  });

  it.each(['ifsc_boulder', 'league_points', 'max_height'] as const)(
    'returns an error result for the unimplemented "%s" format',
    (format) => {
      const result = scoreRound(format, NO_ATTEMPTS, EMPTY_CONFIG);
      expect(result).toEqual({
        ok: false,
        error: { format, message: `scoring format "${format}" not implemented yet` },
      });
    },
  );
});
