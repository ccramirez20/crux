import { ok } from '@crux/core';
import type { Attempt, Result, ScoringFormat } from '@crux/core';
import { scoreClassicTopsZones } from './classic-tops-zones';
import { scoreIfscBoulder } from './ifsc-boulder';
import { scoreLeaguePoints } from './league-points';
import { scoreMaxHeight } from './max-height';
import type { RankedResult, RoundScoringConfig, ScoringError, ScoringStrategyFn } from './types';

export const SCORING_STRATEGIES: Record<ScoringFormat, ScoringStrategyFn> = {
  classic_tops_zones: (attempts, config) => ok(scoreClassicTopsZones(attempts, config)),
  ifsc_boulder: (attempts, config) => ok(scoreIfscBoulder(attempts, config)),
  league_points: (attempts, config) => ok(scoreLeaguePoints(attempts, config)),
  max_height: (attempts, config) => ok(scoreMaxHeight(attempts, config)),
};

export function scoreRound(
  format: ScoringFormat,
  attempts: Attempt[],
  config: RoundScoringConfig,
): Result<RankedResult[], ScoringError> {
  return SCORING_STRATEGIES[format](attempts, config);
}
