import type {
  CategoryScores,
  IsoDateTime,
  PerformanceCategory,
  Uuid,
} from '@/domain/types';

/**
 * A point-in-time readiness result. Stored rather than derived on read, so the
 * athlete can see how the score moved even after benchmarks are retuned.
 * Mirrors the `readiness_scores` table.
 */
export interface ReadinessSnapshot {
  id: Uuid;
  athleteId: Uuid;
  recordedAt: IsoDateTime;
  /** Weighted overall score, 0-100. */
  overall: number;
  /** Per-category scores, 0-100. Absent when the athlete has no data. */
  categories: CategoryScores;
  strongestCategory: PerformanceCategory | null;
  /** Lowest-scoring category once goal emphasis is applied. */
  priorityCategory: PerformanceCategory | null;
  /**
   * Share of the score backed by real results rather than defaults, 0-1.
   * Surfaced in the UI so a sparse score is never presented as confident.
   */
  coverage: number;
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
