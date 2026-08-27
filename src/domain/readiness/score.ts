import {
  findAssessmentEvent,
  latestResultByEvent,
  type AssessmentEventId,
  type AssessmentResult,
} from '@/domain/assessment/types';
import type { Goal } from '@/domain/goals/types';
import {
  PERFORMANCE_CATEGORIES,
  type CategoryScores,
  type IsoDateTime,
  type PerformanceCategory,
} from '@/domain/types';

import { BENCHMARK_VERSION, benchmarkFor, type BenchmarkAnchor } from './benchmarks';
import {
  READINESS_MAX,
  READINESS_MIN,
  type ReadinessCalculation,
  type ReadinessSnapshot,
  type ReadinessTrend,
} from './types';

/**
 * The readiness engine.
 *
 * Every function here is pure and deterministic: same inputs, same output, no
 * clock, no ids, no randomness. That is what makes the score explainable to an
 * athlete and testable in isolation.
 *
 * Nothing here predicts anything. A score states how a performance compares to
 * the Phase 1 benchmark tables, and nothing more.
 */

function clampScore(score: number): number {
  return Math.min(READINESS_MAX, Math.max(READINESS_MIN, score));
}

/**
 * Linear interpolation across benchmark anchors.
 *
 * Anchors are ordered by ascending score, but raw values run in whichever
 * direction the event improves: repetitions climb, times fall. The direction is
 * derived from the table rather than assumed, so a single routine handles both.
 */
export function interpolateScore(anchors: readonly BenchmarkAnchor[], value: number): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (!first || !last) {
    throw new Error('Benchmark table must contain at least one anchor');
  }
  if (!Number.isFinite(value)) {
    return READINESS_MIN;
  }

  const ascending = last.value > first.value;

  // Outside the table, clamp to the nearest end rather than extrapolating.
  if (ascending ? value <= first.value : value >= first.value) {
    return clampScore(first.score);
  }
  if (ascending ? value >= last.value : value <= last.value) {
    return clampScore(last.score);
  }

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const lower = anchors[i];
    const upper = anchors[i + 1];
    if (!lower || !upper) {
      continue;
    }

    const inSegment = ascending
      ? value >= lower.value && value <= upper.value
      : value <= lower.value && value >= upper.value;

    if (inSegment) {
      const span = upper.value - lower.value;
      if (span === 0) {
        return clampScore(upper.score);
      }
      const position = (value - lower.value) / span;
      return clampScore(lower.score + position * (upper.score - lower.score));
    }
  }

  // Unreachable for a well-formed monotonic table; fail safe rather than throw.
  return clampScore(last.score);
}

/** Scores a single raw performance against its benchmark table. */
export function scoreEvent(eventId: AssessmentEventId, value: number): number {
  return interpolateScore(benchmarkFor(eventId), value);
}

/**
 * Scores each performance category from the athlete's most recent result per
 * event. A category with several events (calisthenics has three) averages them,
 * so no single movement dominates.
 *
 * Categories with no results are absent from the map rather than scored zero.
 * Zero would mean "tested and failed"; absent means "not tested".
 */
export function scoreCategories(results: readonly AssessmentResult[]): CategoryScores {
  const latest = latestResultByEvent(results);
  const totals = new Map<PerformanceCategory, { sum: number; count: number }>();

  for (const [eventId, result] of latest) {
    const event = findAssessmentEvent(eventId);
    if (!event) {
      continue; // Unknown event id, e.g. a result from a newer app version.
    }

    const score = scoreEvent(eventId, result.value);
    const running = totals.get(event.category) ?? { sum: 0, count: 0 };
    totals.set(event.category, { sum: running.sum + score, count: running.count + 1 });
  }

  const categories: CategoryScores = {};
  for (const [category, { sum, count }] of totals) {
    categories[category] = Math.round(sum / count);
  }
  return categories;
}

/**
 * Picks the category where improvement buys the most overall score.
 *
 * Weighted headroom, not raw weakness: for a SEAL candidate, swimming at 60
 * (weight 0.30, headroom 12.0) outranks rucking at 55 (weight 0.10, headroom
 * 4.5). Telling that athlete to focus on rucking would be bad coaching.
 */
function selectPriority(categories: CategoryScores, goal: Goal): PerformanceCategory | null {
  let best: PerformanceCategory | null = null;
  let bestHeadroom = -1;

  // Iterating the canonical order keeps ties deterministic.
  for (const category of PERFORMANCE_CATEGORIES) {
    const score = categories[category];
    if (score === undefined) {
      continue;
    }
    const headroom = goal.emphasis[category] * (READINESS_MAX - score);
    if (headroom > bestHeadroom) {
      bestHeadroom = headroom;
      best = category;
    }
  }

  return best;
}

function selectStrongest(categories: CategoryScores): PerformanceCategory | null {
  let best: PerformanceCategory | null = null;
  let bestScore = -1;

  for (const category of PERFORMANCE_CATEGORIES) {
    const score = categories[category];
    if (score !== undefined && score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best;
}

/**
 * Computes an athlete's readiness from their assessment history.
 *
 * Weighting: each category carries the emphasis its goal assigns it, and those
 * weights are renormalised across the categories that actually have data. An
 * athlete who has not tested their swim is not punished with an implicit zero;
 * their score reflects what is known, and `coverage` reports how much that is.
 *
 * Returns null when nothing has been tested, because a score built on no data
 * is not a score.
 */
export function calculateReadiness(
  goal: Goal,
  results: readonly AssessmentResult[],
): ReadinessCalculation | null {
  const categories = scoreCategories(results);

  let weightedTotal = 0;
  let coveredWeight = 0;

  for (const category of PERFORMANCE_CATEGORIES) {
    const score = categories[category];
    if (score === undefined) {
      continue;
    }
    const weight = goal.emphasis[category];
    weightedTotal += score * weight;
    coveredWeight += weight;
  }

  if (coveredWeight <= 0) {
    return null;
  }

  return {
    overall: Math.round(clampScore(weightedTotal / coveredWeight)),
    categories,
    strongestCategory: selectStrongest(categories),
    priorityCategory: selectPriority(categories, goal),
    // Emphasis weights sum to 1, so covered weight is already a fraction.
    coverage: Math.min(1, coveredWeight),
    benchmarkVersion: BENCHMARK_VERSION,
    // This engine scores goal categories and knows nothing about Targets.
    // The caller pairs it with a Target calculation where one exists.
    target: null,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Change in overall score across a window.
 *
 * Compares the newest snapshot against the oldest one still inside the window,
 * which answers "how far have I moved this month" rather than "what happened
 * between my last two tests".
 *
 * `now` is injected rather than read from the clock so this stays pure.
 */
export function calculateTrend(
  history: readonly ReadinessSnapshot[],
  windowDays: number,
  now: IsoDateTime,
): ReadinessTrend | null {
  if (history.length === 0) {
    return null;
  }

  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    return null;
  }
  const cutoff = nowMs - windowDays * MS_PER_DAY;

  const sorted = [...history].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const newest = sorted[sorted.length - 1];
  if (!newest) {
    return null;
  }

  const baseline = sorted.find((snapshot) => Date.parse(snapshot.recordedAt) >= cutoff);

  // Only one snapshot inside the window means there is nothing to compare to.
  if (!baseline || baseline === newest) {
    return { delta: 0, windowDays, comparedTo: null };
  }

  return {
    delta: newest.overall - baseline.overall,
    windowDays,
    comparedTo: baseline.recordedAt,
  };
}
