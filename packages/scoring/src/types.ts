import type { Attempt, Result, ScoringFormat } from '@crux/core';

export interface RoundScoringConfig {
  problemIds: string[];
  registrationIds: string[];
  problemPoints?: Record<string, { topPoints: number; zonePoints: number | null }>;
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

export interface IfscBoulderResult {
  format: 'ifsc_boulder';
  rank: number;
  tied: boolean;
  registrationId: string;
  score: number;
}

export interface LeaguePointsResult {
  format: 'league_points';
  rank: number;
  tied: boolean;
  registrationId: string;
  score: number;
}

export interface MaxHeightResult {
  format: 'max_height';
  rank: number;
  tied: boolean;
  registrationId: string;
  height: number;
  // Termino la via. Gana sobre cualquier altura, incluso sin altura capturada.
  top: boolean;
}

// Union of one today; each shipped strategy adds its own variant here.
export type RankedResult =
  | ClassicTopsZonesResult
  | IfscBoulderResult
  | LeaguePointsResult
  | MaxHeightResult;

export interface ScoringError {
  format: ScoringFormat;
  message: string;
}

export type ScoringStrategyFn = (
  attempts: Attempt[],
  config: RoundScoringConfig,
) => Result<RankedResult[], ScoringError>;
