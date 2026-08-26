/**
 * Readiness bands.
 *
 * A number on its own does not tell an athlete much: 68 is meaningless without
 * knowing whether that is early days or nearly there. The band is the plain
 * reading of the score.
 *
 * Deliberately not framed as a verdict on the person or a prediction of
 * outcome. "Developing" describes a state of preparation, not a judgement of
 * potential, and nothing here implies a chance of selection.
 */

export const READINESS_BANDS = ['early', 'building', 'developing', 'prepared'] as const;

export type ReadinessBand = (typeof READINESS_BANDS)[number];

export const READINESS_BAND_LABELS: Record<ReadinessBand, string> = {
  early: 'Early',
  building: 'Building',
  developing: 'Developing',
  prepared: 'Prepared',
};

/** What each band means, in the athlete's terms. */
export const READINESS_BAND_DESCRIPTIONS: Record<ReadinessBand, string> = {
  early: 'You are at the start. Consistency matters more than intensity right now.',
  building: 'The base is forming. Keep the volume steady and let it accumulate.',
  developing: 'Real progress. Push the areas holding your score back.',
  prepared: 'You are meeting Phase 1 benchmarks across the board. Hold it and sharpen.',
};

/** Inclusive lower bound of each band. */
const BAND_FLOORS: readonly { band: ReadinessBand; floor: number }[] = [
  { band: 'prepared', floor: 80 },
  { band: 'developing', floor: 60 },
  { band: 'building', floor: 40 },
  { band: 'early', floor: 0 },
];

export function readinessBand(score: number): ReadinessBand {
  const clamped = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  for (const { band, floor } of BAND_FLOORS) {
    if (clamped >= floor) {
      return band;
    }
  }
  return 'early';
}

/**
 * The readiness Phase 1 suggests aiming for before selection.
 *
 * A Phase 1 benchmark, not a threshold anyone official recognises, and not a
 * promise that reaching it means anything beyond having met Phase 1's own
 * preparation targets.
 */
export const PHASE1_TARGET_READINESS = 80;
