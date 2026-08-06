import type { Attempt, Result, ScoringFormat } from '@crux/core';

export interface RoundScoringConfig {
  problemIds: string[];
  registrationIds: string[];
}

export interface ClassicTopsZonesResult {
  format: 'classic_tops_zones';
  rank: number;
  tied: boolean;
  registrationId: string;
  tops: number;
  topAttempts: number;
  zones: number;
  zoneAttempts: number;
}

// Union of one today; each shipped strategy adds its own variant here.
export type RankedResult = ClassicTopsZonesResult;

export interface ScoringError {
  format: ScoringFormat;
  message: string;
}

export type ScoringStrategyFn = (
  attempts: Attempt[],
  config: RoundScoringConfig,
) => Result<RankedResult[], ScoringError>;
