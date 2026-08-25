import type {
  CategoryScores,
  IsoDateTime,
  PerformanceCategory,
  Uuid,
} from '@/domain/types';

/**
 * The result of scoring an athlete, with no identity or clock attached.
 *
 * Keeping this separate from the stored snapshot is what lets the scoring
 * function stay pure: no ids, no timestamps, no randomness. The repository
 * layer is responsible for stamping a calculation into a persisted row.
 */
export interface ReadinessCalculation {
  /** Weighted overall score, 0-100. */
  overall: number;
  /** Per-category scores, 0-100. A category is absent when it has no data. */
  categories: CategoryScores;
  strongestCategory: PerformanceCategory | null;
  /**
   * Where improvement would move the overall score most. This is weighted
   * headroom, not simply the lowest score: a weak category that barely matters
   * to the athlete's goal is not the priority.
   */
  priorityCategory: PerformanceCategory | null;
  /**
   * Share of the athlete's goal-weighted profile backed by real results, 0-1.
   * Surfaced in the UI so a sparse score is never presented as confident.
   */
  coverage: number;
  /** Benchmark table version used, so historical scores stay interpretable. */
  benchmarkVersion: number;
}

/**
 * A point-in-time readiness result as stored. Mirrors `readiness_scores`.
 * Scores are stored rather than derived on read so the athlete can see how the
 * number moved even after benchmarks are retuned.
 */
export interface ReadinessSnapshot extends ReadinessCalculation {
  id: Uuid;
  athleteId: Uuid;
  recordedAt: IsoDateTime;
}

export interface ReadinessTrend {
  /** Signed change in overall score across the window. */
  delta: number;
  windowDays: number;
  /** Snapshot the delta was measured against, if one exists in the window. */
  comparedTo: IsoDateTime | null;
}

export const READINESS_MIN = 0;
export const READINESS_MAX = 100;
