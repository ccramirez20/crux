// 'speed' deferred — see packages/db/src/schema.ts's disciplineEnum comment.
export const DISCIPLINES = ['boulder', 'lead'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const ROUND_TYPES = ['qualification', 'semifinal', 'final'] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

export const GENDERS = ['male', 'female', 'mixed'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Identifier for a packages/scoring strategy. The registry mapping each
 * value to its score() function lives in packages/scoring, not here — core
 * stays IO- and logic-free.
 */
export type ScoringFormat =
  | 'ifsc_boulder'
  | 'classic_tops_zones'
  | 'league_points'
  | 'max_height';

export interface Attempt {
  id: string;
  /** Monotonic tiebreak: the current value for a (registrationId, problemId) pair is the row with the highest sequence. */
  sequence: number;
  clientAttemptId: string;
  registrationId: string;
  problemId: string;
  judgeLabel: string;
  top: boolean;
  topAttempts: number | null;
  zone: boolean;
  zoneAttempts: number | null;
  height: number | null;
  capturedAt: Date;
  createdAt: Date;
}

export { isEligible, parseDateOnly } from './eligibility';
export type { EligibilityCategory } from './eligibility';

export { ok, err } from './result';
export type { Result } from './result';
