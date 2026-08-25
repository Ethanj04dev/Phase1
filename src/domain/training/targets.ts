import {
  latestResultByEvent,
  type AssessmentEventId,
  type AssessmentResult,
} from '@/domain/assessment/types';

import type { PaceBasis, PaceTarget } from './types';

/**
 * Turns a programme's declared pace *relationship* into concrete numbers for
 * one athlete.
 *
 * This is what makes two athletes on the same session see different targets.
 * A programme never says "800m in 3:07"; it says "800m at 6 percent faster
 * than your mile pace", and this resolves that against what the athlete has
 * actually run.
 *
 * Pure and deterministic. No clock, no repository.
 */

/** Which assessment event each basis reads from. */
const BASIS_EVENT: Record<PaceBasis, AssessmentEventId> = {
  mile_time: 'run_1_mile',
  one_and_half_mile_time: 'run_1_5_mile',
  swim_500_time: 'swim_500m',
  ruck_pace: 'ruck_3_mile',
};

const EVENT_DISTANCE_METERS: Record<AssessmentEventId, number> = {
  pull_ups: 0,
  push_ups: 0,
  sit_ups: 0,
  run_1_mile: 1609.344,
  run_1_5_mile: 2414.016,
  swim_500m: 500,
  ruck_3_mile: 4828.032,
};

/** Run events that can substitute for one another via a pace conversion. */
const RUN_EVENTS: readonly AssessmentEventId[] = ['run_1_mile', 'run_1_5_mile'];

/**
 * Riegel's endurance formula: T2 = T1 * (D2 / D1) ^ 1.06.
 *
 * The exponent above 1 encodes the fact that pace degrades as distance grows,
 * which is why a straight per-metre scaling would hand a 1.5-mile runner an
 * unrealistically fast mile target. This is a long-standing, published
 * formula rather than anything invented here.
 */
const RIEGEL_EXPONENT = 1.06;

export function convertRunTime(
  knownSeconds: number,
  knownMeters: number,
  targetMeters: number,
): number {
  return knownSeconds * Math.pow(targetMeters / knownMeters, RIEGEL_EXPONENT);
}

export interface ResolvedTarget {
  /** Fast end of the window, in seconds per repetition. */
  lowSeconds: number;
  /** Slow end of the window, in seconds per repetition. */
  highSeconds: number;
  /** Midpoint, in seconds per repetition. */
  targetSeconds: number;
  basis: PaceBasis;
  /**
   * True when the basis event has not been tested and the target was
   * converted from a related distance. Surfaced so the athlete knows the
   * number is inferred rather than measured.
   */
  estimated: boolean;
}

/**
 * Seconds per metre for a basis, or null when the athlete has no usable data.
 *
 * Running falls back to a converted time from the other run distance. Swimming
 * and rucking have a single measurable event each, so an untested athlete gets
 * null rather than a guess derived from an unrelated discipline.
 */
function basisPacePerMeter(
  basis: PaceBasis,
  results: readonly AssessmentResult[],
): { pace: number; estimated: boolean } | null {
  const latest = latestResultByEvent(results);
  const basisEvent = BASIS_EVENT[basis];

  const direct = latest.get(basisEvent);
  if (direct) {
    const distance = EVENT_DISTANCE_METERS[basisEvent];
    return distance > 0 ? { pace: direct.value / distance, estimated: false } : null;
  }

  if (!RUN_EVENTS.includes(basisEvent)) {
    return null;
  }

  for (const candidate of RUN_EVENTS) {
    if (candidate === basisEvent) {
      continue;
    }
    const substitute = latest.get(candidate);
    if (!substitute) {
      continue;
    }
    const from = EVENT_DISTANCE_METERS[candidate];
    const to = EVENT_DISTANCE_METERS[basisEvent];
    if (from <= 0 || to <= 0) {
      continue;
    }
    const converted = convertRunTime(substitute.value, from, to);
    return { pace: converted / to, estimated: true };
  }

  return null;
}

/**
 * Resolves a target for one repetition over `distanceMeters`.
 *
 * Returns null when the athlete has nothing to derive from. Callers must fall
 * back to an effort-based prescription rather than inventing a time.
 */
export function resolvePaceTarget(
  target: PaceTarget,
  distanceMeters: number,
  results: readonly AssessmentResult[],
): ResolvedTarget | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return null;
  }

  const basis = basisPacePerMeter(target.basis, results);
  if (!basis) {
    return null;
  }

  const targetSeconds = basis.pace * distanceMeters * target.factor;
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) {
    return null;
  }

  const tolerance = Math.max(0, target.toleranceSeconds);

  return {
    targetSeconds,
    // The window never opens below zero, however tight the prescription.
    lowSeconds: Math.max(1, targetSeconds - tolerance),
    highSeconds: targetSeconds + tolerance,
    basis: target.basis,
    estimated: basis.estimated,
  };
}
