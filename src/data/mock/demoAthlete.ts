import type { AthleteProfile } from '@/domain/athlete/types';
import type { ReadinessSnapshot, ReadinessTrend } from '@/domain/readiness/types';
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

export const demoReadiness: ReadinessSnapshot = {
  id: 'demo-readiness-0007',
  athleteId: DEMO_ATHLETE_ID,
  recordedAt: '2026-08-25T08:00:00.000Z',
  overall: 72,
  categories: {
    running: 76,
    swimming: 61,
    calisthenics: 84,
    rucking: 69,
    strength: 70,
  },
  strongestCategory: 'calisthenics',
  priorityCategory: 'swimming',
  coverage: 0.86,
};

export const demoReadinessTrend: ReadinessTrend = {
  delta: 4,
  windowDays: 30,
  comparedTo: '2026-07-26T08:00:00.000Z',
};

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
