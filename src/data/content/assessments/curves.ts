import type { EventScoringCurve, RatingBand } from '@/domain/scoring/config';

/**
 * Provisional scoring curves, version 1.
 *
 * These are authored estimates of where candidate performances sit on a
 * 0–1000 scale, and every config that uses them says 'provisional'. They are
 * deliberately nonlinear: anchors are spaced so improvement near competitive
 * standards buys more than the same improvement at the slow end, and very
 * high repetition counts see diminishing returns. Calibration against real
 * verified data replaces these curves in a later config version; nothing
 * downstream hard-codes them.
 *
 * Shared across assessments for now — a 500m practice swim scores the same
 * curve wherever it appears. Per-assessment divergence is a matter of giving
 * an assessment its own curve here, not of changing the engine.
 */

export const PULL_UPS_CURVE_V1: EventScoringCurve = {
  eventId: 'pull_ups',
  weight: 1,
  anchors: [
    { value: 0, points: 0 },
    { value: 5, points: 120 },
    { value: 10, points: 350 },
    { value: 15, points: 600 },
    { value: 20, points: 800 },
    { value: 25, points: 920 },
    { value: 30, points: 1000 },
  ],
};

export const PUSH_UPS_CURVE_V1: EventScoringCurve = {
  eventId: 'push_ups',
  weight: 1,
  anchors: [
    { value: 0, points: 0 },
    { value: 30, points: 200 },
    { value: 40, points: 400 },
    { value: 50, points: 600 },
    { value: 60, points: 750 },
    { value: 70, points: 870 },
    { value: 80, points: 940 },
    { value: 100, points: 1000 },
  ],
};

export const SIT_UPS_CURVE_V1: EventScoringCurve = {
  eventId: 'sit_ups',
  weight: 1,
  anchors: [
    { value: 0, points: 0 },
    { value: 30, points: 180 },
    { value: 40, points: 350 },
    { value: 50, points: 550 },
    { value: 60, points: 700 },
    { value: 70, points: 830 },
    { value: 80, points: 920 },
    { value: 100, points: 1000 },
  ],
};

/** Seconds; faster is better, so points fall as the value rises. */
export const RUN_1_5_MILE_CURVE_V1: EventScoringCurve = {
  eventId: 'run_1_5_mile',
  weight: 1,
  anchors: [
    { value: 450, points: 1000 }, // 7:30
    { value: 480, points: 950 }, // 8:00
    { value: 510, points: 880 }, // 8:30
    { value: 540, points: 780 }, // 9:00
    { value: 570, points: 660 }, // 9:30
    { value: 600, points: 520 }, // 10:00
    { value: 660, points: 320 }, // 11:00
    { value: 720, points: 160 }, // 12:00
    { value: 780, points: 60 }, // 13:00
    { value: 840, points: 0 }, // 14:00
  ],
};

export const SWIM_500M_CURVE_V1: EventScoringCurve = {
  eventId: 'swim_500m',
  weight: 1,
  anchors: [
    { value: 420, points: 1000 }, // 7:00
    { value: 480, points: 900 }, // 8:00
    { value: 540, points: 780 }, // 9:00
    { value: 600, points: 620 }, // 10:00
    { value: 660, points: 460 }, // 11:00
    { value: 720, points: 300 }, // 12:00
    { value: 840, points: 120 }, // 14:00
    { value: 900, points: 0 }, // 15:00
  ],
};

/**
 * The shared band ladder, version 1. Floors are on the 0–1000 rating scale.
 * Provisional like the curves; the labels describe the scale, not any
 * official standard.
 */
export const RATING_BANDS_V1: readonly RatingBand[] = [
  { id: 'developing', label: 'Developing', floor: 0 },
  { id: 'competitive', label: 'Competitive', floor: 550 },
  { id: 'highly_competitive', label: 'Highly competitive', floor: 700 },
  { id: 'elite', label: 'Elite', floor: 850 },
];
