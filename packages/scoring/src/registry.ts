import { err, ok } from '@crux/core';
import type { Attempt, Result, ScoringFormat } from '@crux/core';
import { scoreClassicTopsZones } from './classic-tops-zones';
import type { RankedResult, RoundScoringConfig, ScoringError, ScoringStrategyFn } from './types';

function notImplemented(format: ScoringFormat): ScoringStrategyFn {
  return () => err({ format, message: `scoring format "${format}" not implemented yet` });
}

export const SCORING_STRATEGIES: Record<ScoringFormat, ScoringStrategyFn> = {
  classic_tops_zones: (attempts, config) => ok(scoreClassicTopsZones(attempts, config)),
  ifsc_boulder: notImplemented('ifsc_boulder'),
  league_points: notImplemented('league_points'),
  max_height: notImplemented('max_height'),
};

export function scoreRound(
  format: ScoringFormat,
  attempts: Attempt[],
  config: RoundScoringConfig,
): Result<RankedResult[], ScoringError> {
  return SCORING_STRATEGIES[format](attempts, config);
}
