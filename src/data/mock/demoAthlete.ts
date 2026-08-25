import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { ResolvedWorkoutDay } from '@/domain/training/types';

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

/** Position in the program, shown as WEEK 04 / DAY 03. */
export const demoProgramPosition = {
  weekNumber: 4,
  dayNumber: 3,
  weekFocus: 'Aerobic volume',
} as const;

export const demoToday: ResolvedWorkoutDay = {
  id: 'demo-day-0025',
  programWeekId: 'demo-week-0004',
  dayNumber: 3,
  title: 'Interval Run + Pool',
  description: 'Threshold running followed by low-intensity water work.',
  restDay: false,
  sessions: [
    {
      id: 'demo-session-0051',
      workoutDayId: 'demo-day-0025',
      order: 1,
      modality: 'running',
      title: 'Interval Run',
      estimatedMinutes: 48,
      blocks: [
        {
          id: 'demo-block-0101',
          order: 1,
          kind: 'steady',
          name: 'Warm-up',
          distanceMeters: 1600,
          effort: { rpe: 3 },
        },
        {
          id: 'demo-block-0102',
          order: 2,
          kind: 'interval',
          name: '800m repeats',
          reps: 6,
          distanceMeters: 800,
          recoverySeconds: 120,
          // Roughly 6 percent faster than current mile pace.
          target: { basis: 'mile_time', factor: 0.94, toleranceSeconds: 5 },
        },
        {
          id: 'demo-block-0103',
          order: 3,
          kind: 'steady',
          name: 'Cool-down',
          distanceMeters: 1200,
          effort: { rpe: 2 },
        },
      ],
    },
    {
      id: 'demo-session-0052',
      workoutDayId: 'demo-day-0025',
      order: 2,
      modality: 'calisthenics',
      title: 'Calisthenics',
      estimatedMinutes: 20,
      blocks: [
        {
          id: 'demo-block-0201',
          order: 1,
          kind: 'calisthenics',
          name: 'Pull-ups',
          sets: 5,
          reps: 'max',
          restSeconds: 120,
        },
        {
          id: 'demo-block-0202',
          order: 2,
          kind: 'calisthenics',
          name: 'Push-ups',
          sets: 5,
          reps: 25,
          restSeconds: 90,
        },
      ],
    },
    {
      id: 'demo-session-0053',
      workoutDayId: 'demo-day-0025',
      order: 3,
      modality: 'swimming',
      title: 'Pool Session',
      estimatedMinutes: 35,
      blocks: [
        {
          id: 'demo-block-0301',
          order: 1,
          kind: 'swim',
          name: '100m repeats',
          reps: 8,
          distanceMeters: 100,
          restSeconds: 45,
          effort: { rpe: 5 },
        },
      ],
    },
  ],
};

export const demoStreakDays = 11;
export const demoWeeklyCompletion = 0.6;
