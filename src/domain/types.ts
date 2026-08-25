/** Shared domain primitives. Deliberately brand-neutral. */

/** ISO-8601 timestamp, e.g. "2026-08-25T14:03:00.000Z". */
export type IsoDateTime = string;

/** ISO-8601 calendar date, e.g. "2026-08-25". */
export type IsoDate = string;

export type Uuid = string;

/**
 * The five performance domains the product measures. Every readiness score,
 * benchmark and program emphasis is expressed in terms of these.
 */
export const PERFORMANCE_CATEGORIES = [
  'running',
  'swimming',
  'calisthenics',
  'rucking',
  'strength',
] as const;

export type PerformanceCategory = (typeof PERFORMANCE_CATEGORIES)[number];

export const PERFORMANCE_CATEGORY_LABELS: Record<PerformanceCategory, string> = {
  running: 'Running',
  swimming: 'Swimming',
  calisthenics: 'Calisthenics',
  rucking: 'Rucking',
  strength: 'Strength',
};

/** Weighting across categories. Values are expected to sum to 1. */
export type CategoryWeights = Record<PerformanceCategory, number>;

/** Partial score map. A category is absent when the athlete has no data for it. */
export type CategoryScores = Partial<Record<PerformanceCategory, number>>;

export type ExperienceLevel = 'none' | 'beginner' | 'intermediate' | 'advanced';

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  none: 'None',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Discriminated result type. Keeps repository failures out of throw sites. */
export type Result<T, E = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface DomainError {
  code: DomainErrorCode;
  /** Safe to show a user. Never contains raw backend text. */
  message: string;
  /** Original error, for logging only. */
  cause?: unknown;
}

export type DomainErrorCode =
  | 'not_found'
  | 'unauthorized'
  | 'network'
  | 'validation'
  | 'conflict'
  | 'unknown';

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = DomainError>(error: E): Result<never, E> {
  return { ok: false, error };
}
