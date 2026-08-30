import type { AssessmentEventId } from '@/domain/assessment/types';

/**
 * Benchmark tables translate a raw performance into a 0-100 category score.
 *
 * These are Zero Phase benchmarks: an editorial, published, adjustable opinion
 * about what a well-prepared athlete looks like. They are NOT any
 * organisation's official standards, they are not derived from any proprietary
 * programme, and a score against them predicts nothing about selection.
 *
 * Design notes:
 * - Anchors are ordered by ascending score. Scores between anchors are
 *   linearly interpolated, so improvement always moves the number rather than
 *   jumping at thresholds.
 * - A score of 100 means "at the top of the Zero Phase scale", not "maximum human
 *   performance". The scale is deliberately reachable.
 * - Values below the first anchor floor at 0; above the last, cap at 100.
 */

export interface BenchmarkAnchor {
  /** Raw performance: repetitions, or seconds, per the event unit. */
  value: number;
  /** Score awarded at exactly this value, 0-100. */
  score: number;
}

/**
 * Bumped whenever an anchor changes. Stored on each readiness snapshot so a
 * historical score stays interpretable after the tables are retuned.
 */
export const BENCHMARK_VERSION = 1;

export const BENCHMARKS: Record<AssessmentEventId, readonly BenchmarkAnchor[]> = {
  pull_ups: [
    { value: 0, score: 0 },
    { value: 5, score: 25 },
    { value: 10, score: 50 },
    { value: 15, score: 70 },
    { value: 20, score: 85 },
    { value: 25, score: 95 },
    { value: 30, score: 100 },
  ],

  push_ups: [
    { value: 0, score: 0 },
    { value: 25, score: 25 },
    { value: 45, score: 50 },
    { value: 60, score: 70 },
    { value: 75, score: 85 },
    { value: 90, score: 95 },
    { value: 100, score: 100 },
  ],

  sit_ups: [
    { value: 0, score: 0 },
    { value: 30, score: 25 },
    { value: 50, score: 50 },
    { value: 65, score: 70 },
    { value: 80, score: 85 },
    { value: 95, score: 95 },
    { value: 105, score: 100 },
  ],

  // Times in seconds. Anchors descend in value as the score rises.
  run_1_mile: [
    { value: 600, score: 0 }, // 10:00
    { value: 540, score: 20 }, // 9:00
    { value: 480, score: 40 }, // 8:00
    { value: 420, score: 60 }, // 7:00
    { value: 390, score: 75 }, // 6:30
    { value: 360, score: 88 }, // 6:00
    { value: 330, score: 100 }, // 5:30
  ],

  run_1_5_mile: [
    { value: 900, score: 0 }, // 15:00
    { value: 810, score: 20 }, // 13:30
    { value: 750, score: 35 }, // 12:30
    { value: 690, score: 50 }, // 11:30
    { value: 630, score: 70 }, // 10:30
    { value: 588, score: 85 }, // 9:48
    { value: 540, score: 100 }, // 9:00
  ],

  swim_500m: [
    { value: 900, score: 0 }, // 15:00
    { value: 780, score: 20 }, // 13:00
    { value: 690, score: 40 }, // 11:30
    { value: 630, score: 55 }, // 10:30
    { value: 570, score: 70 }, // 9:30
    { value: 510, score: 85 }, // 8:30
    { value: 450, score: 100 }, // 7:30
  ],

  ruck_3_mile: [
    { value: 3600, score: 0 }, // 20:00 per mile
    { value: 3240, score: 25 }, // 18:00 per mile
    { value: 2970, score: 45 }, // 16:30 per mile
    { value: 2700, score: 65 }, // 15:00 per mile
    { value: 2520, score: 80 }, // 14:00 per mile
    { value: 2340, score: 92 }, // 13:00 per mile
    { value: 2160, score: 100 }, // 12:00 per mile
  ],
};

export function benchmarkFor(eventId: AssessmentEventId): readonly BenchmarkAnchor[] {
  return BENCHMARKS[eventId];
}
