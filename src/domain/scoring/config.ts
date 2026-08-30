import type { AssessmentEventId } from '@/domain/assessment/types';

/**
 * Versioned scoring configuration.
 *
 * Everything numeric about how a performance becomes a rating lives here —
 * curves, weights, bands — and nowhere else. Screens render what the engine
 * returns; they never carry scoring constants of their own. When the curves
 * are retuned, a new config version ships and every rating records which
 * version produced it, so historical numbers stay interpretable.
 */

export const RATING_MIN = 0;
export const RATING_MAX = 1000;

/**
 * One point on a scoring curve: this raw value is worth this many points.
 *
 * Curves are piecewise-linear between anchors, which is deliberately more
 * expressive than a straight line: spacing the anchors unevenly is how a
 * curve says that cutting a run from 9:00 to 8:30 matters more than cutting
 * it from 12:00 to 11:30, and that the fortieth pull-up buys less than the
 * fifteenth. Values outside the anchor range clamp to the end points.
 */
export interface ScoringAnchor {
  /** Raw event value: reps, or seconds, per the event unit. */
  value: number;
  /** Points awarded at exactly this value, 0–1000. */
  points: number;
}

export interface EventScoringCurve {
  eventId: AssessmentEventId;
  /**
   * Anchors in strictly ascending raw-value order. For rep events points
   * rise along the anchors; for timed events they fall. The direction comes
   * from the event catalog, never assumed here.
   */
  anchors: readonly ScoringAnchor[];
  /** Relative weight of this event in the overall rating. */
  weight: number;
}

/**
 * Named bands over the 0–1000 scale, lowest first. `floor` is the lowest
 * rating inside the band. Bands describe the rating scale itself, so the
 * same rating always lands in the same band under one config version.
 */
export interface RatingBand {
  /** Stable id, e.g. 'competitive'. */
  id: string;
  label: string;
  floor: number;
}

export interface ScoringConfig {
  /** The assessment protocol this config scores. */
  definitionId: string;
  definitionVersion: number;
  /** Bumped whenever any curve, weight or band changes. */
  configVersion: number;
  events: readonly EventScoringCurve[];
  bands: readonly RatingBand[];
  /**
   * Honesty marker, like assessment definitions: 'provisional' curves are
   * authored estimates and say so; 'calibrated' waits for real data.
   */
  provenance: 'provisional' | 'calibrated';
}

/** The band a rating falls in, or null when the config defines no bands. */
export function ratingBand(config: ScoringConfig, rating: number): RatingBand | null {
  let match: RatingBand | null = null;
  for (const band of config.bands) {
    if (rating >= band.floor && (match === null || band.floor > match.floor)) {
      match = band;
    }
  }
  return match;
}
