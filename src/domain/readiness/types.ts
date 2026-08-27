import type { PreparationDomainId } from '@/domain/target/domains';
import type { TargetId } from '@/domain/target/types';
import type { CategoryScores, IsoDateTime, PerformanceCategory, Uuid } from '@/domain/types';

import type { DomainScores } from './targetScore';

/**
 * The Target-aware half of a snapshot.
 *
 * Stored alongside the legacy category scores rather than replacing them,
 * because the two are different scales and cannot be compared. The same
 * athlete scores differently under four goal-weighted categories than under
 * eight target-weighted domains, so plotting both on one line would show a
 * jump that never happened.
 *
 * Null on rows written before Targets existed, and on athletes whose career
 * has no Target definition yet. A reader that finds null must say so rather
 * than substituting the legacy number.
 */
export interface TargetReadinessRecord {
  targetId: TargetId;
  /** Weighted overall against the Target's own domains, 0-100. */
  overall: number;
  domains: DomainScores;
  strongestDomain: PreparationDomainId | null;
  priorityDomain: PreparationDomainId | null;
  /** Share of the Target's weighted profile backed by real data, 0-1. */
  coverage: number;
}

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
  /**
   * The same instant scored against the athlete's Target. Null where there is
   * no Target definition, or on rows written before Targets existed.
   */
  target: TargetReadinessRecord | null;
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
