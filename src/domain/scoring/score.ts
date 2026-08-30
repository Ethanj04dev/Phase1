import type { AssessmentEventId } from '@/domain/assessment/types';
import type { AttemptEventResult } from '@/domain/attempt/types';

import {
  RATING_MAX,
  RATING_MIN,
  type EventScoringCurve,
  type ScoringConfig,
} from './config';

/**
 * The scoring engine. Pure: config and results in, rating out.
 *
 * It scores complete attempts only. An attempt missing any configured event
 * gets per-event points for what was performed but no overall rating —
 * a rating from a partial assessment would be a number for a performance
 * that did not happen, which is exactly what this product refuses to print.
 *
 * The same function produces the client's clearly-labelled estimate today
 * and the server's official rating in M3. One implementation, two trust
 * levels; the difference is who ran it and what the input had been through,
 * never the arithmetic.
 */

export interface EventScore {
  eventId: AssessmentEventId;
  value: number;
  /** Points on the 0–1000 scale for this event alone. */
  points: number;
}

export interface AttemptScore {
  /**
   * Overall rating, 0–1000, rounded. Null when the attempt does not cover
   * every configured event — incomplete performances never get a number.
   */
  rating: number | null;
  /** Whether every configured event had a result. */
  complete: boolean;
  /** Scores for the events that were performed, in config order. */
  eventScores: readonly EventScore[];
  /** Stamped so stored ratings stay interpretable after retuning. */
  configVersion: number;
}

/**
 * Piecewise-linear interpolation over the curve's anchors.
 *
 * Values outside the anchor range clamp to the end anchors: running faster
 * than the fastest anchor is worth the maximum the curve awards, not a
 * number off the top of the scale.
 */
export function scoreEvent(curve: EventScoringCurve, value: number): number {
  const anchors = curve.anchors;
  if (anchors.length === 0) {
    return RATING_MIN;
  }

  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (value <= first.value) {
    return clampPoints(first.points);
  }
  if (value >= last.value) {
    return clampPoints(last.points);
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const upper = anchors[index]!;
    if (value <= upper.value) {
      const lower = anchors[index - 1]!;
      const span = upper.value - lower.value;
      const fraction = span === 0 ? 0 : (value - lower.value) / span;
      return clampPoints(lower.points + fraction * (upper.points - lower.points));
    }
  }

  return clampPoints(last.points);
}

function clampPoints(points: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, points));
}

export function scoreAttempt(
  config: ScoringConfig,
  results: readonly AttemptEventResult[],
): AttemptScore {
  const byEvent = new Map(results.map((result) => [result.eventId, result]));

  const eventScores: EventScore[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let complete = true;

  for (const curve of config.events) {
    const result = byEvent.get(curve.eventId);
    if (!result) {
      complete = false;
      continue;
    }
    const points = scoreEvent(curve, result.value);
    eventScores.push({ eventId: curve.eventId, value: result.value, points });
    weightedSum += points * curve.weight;
    weightTotal += curve.weight;
  }

  const rating =
    complete && weightTotal > 0 ? Math.round(clampPoints(weightedSum / weightTotal)) : null;

  return {
    rating,
    complete,
    eventScores,
    configVersion: config.configVersion,
  };
}
