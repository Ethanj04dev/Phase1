import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';

/**
 * Demo content for building screens before the backend exists.
 *
 * This module is imported only by the mock repository layer. Screens must
 * never import it directly, so swapping in Supabase is a one-file change.
 */

const DEMO_ATHLETE_ID = 'demo-athlete-0001';

export const demoProfile: AthleteProfile = {
  id: DEMO_ATHLETE_ID,
  userId: 'demo-user-0001',
  displayName: 'Athlete',
  goalId: 'pararescue',
  trackId: 'selection_prep',
  runningExperience: 'intermediate',
  swimmingExperience: 'beginner',
  ruckingExperience: 'intermediate',
  trainingDaysPerWeek: 5,
  // Roughly fourteen weeks past demoNow, so the countdown renders in demo.
  selectionDate: '2026-12-01',
  onboardingCompleted: true,
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-08-25T08:00:00.000Z',
};

/**
 * Three rounds of testing across roughly ten weeks.
 *
 * Readiness is no longer written down here as a number. These raw performances
 * are the only input, and the mock repository runs them through the real
 * scoring engine, so the demo dashboard exercises the same code path an actual
 * athlete will.
 *
 * The athlete is a competent runner and a weak swimmer, which is what makes
 * swimming surface as the priority for a Pararescue goal.
 */
const DEMO_TEST_DATES = [
  '2026-06-15T08:00:00.000Z',
  '2026-07-28T08:00:00.000Z',
  '2026-08-18T08:00:00.000Z',
] as const;

/** Raw values per event, in the same order as DEMO_TEST_DATES. */
const DEMO_PERFORMANCES: Record<AssessmentEventId, readonly number[]> = {
  pull_ups: [11, 14, 16],
  push_ups: [48, 55, 60],
  sit_ups: [58, 64, 68],
  run_1_mile: [438, 420, 408],
  run_1_5_mile: [690, 648, 624],
  swim_500m: [690, 645, 618],
  ruck_3_mile: [2970, 2850, 2760],
};

function buildDemoResults(): AssessmentResult[] {
  const results: AssessmentResult[] = [];

  DEMO_TEST_DATES.forEach((recordedAt, round) => {
    for (const [eventId, values] of Object.entries(DEMO_PERFORMANCES)) {
      const value = values[round];
      if (value === undefined) {
        continue;
      }
      results.push({
        id: `demo-result-${eventId}-${round}`,
        athleteId: DEMO_ATHLETE_ID,
        eventId: eventId as AssessmentEventId,
        value,
        recordedAt,
        notes: null,
      });
    }
  });

  return results;
}

export const demoAssessmentResults: readonly AssessmentResult[] = buildDemoResults();

/** Test dates, oldest first. Used to build the readiness history. */
export const demoAssessmentDates: readonly string[] = DEMO_TEST_DATES;

/**
 * Fixed "now" for the demo so the trend window is stable regardless of when the
 * app is opened during development.
 */
export const demoNow = '2026-08-25T08:00:00.000Z';
