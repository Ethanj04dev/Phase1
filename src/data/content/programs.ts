import type { TrainingTrackId } from '@/domain/athlete/types';
import type { GoalId } from '@/domain/goals/types';

import { adaptPlanForPipeline } from './adaptPlan';
import { buildProgram, type BuiltProgram, type TrackPlan, type WeekPlan } from './buildProgram';
import { findPipeline } from './pipelines';
import {
  calisthenicsBlock,
  calisthenicsSession,
  easyRunSession,
  intervalRunSession,
  poolSession,
  recoveryDay,
  restDay,
  ruckSession,
  standardCalisthenics,
  strengthBlock,
  strengthSession,
  swimIntervals,
  swimSet,
  tempoRunSession,
} from './sessions';

/**
 * The three training tracks.
 *
 * Each is an eight-week block built from a repeating week shape with
 * progressive volume and a deload every fourth week. Volume grows through a
 * block, then drops so the athlete absorbs the work rather than accumulating
 * fatigue until something breaks.
 *
 * Content is original to Zero Phase and deliberately conservative. Nothing here
 * is adapted from a third-party paid programme, and none of it claims to
 * reproduce any organisation's standards.
 */

const BLOCK_WEEKS = 8;

/** Every fourth week backs off. */
function isDeload(weekNumber: number): boolean {
  return weekNumber % 4 === 0;
}

/**
 * Volume multiplier for a week. Builds roughly 7 percent per week inside a
 * block, and drops to 65 percent on a deload.
 */
function volumeFactor(weekNumber: number): number {
  if (isDeload(weekNumber)) {
    return 0.65;
  }
  const weeksIntoBlock = (weekNumber - 1) % 4;
  const blockIndex = Math.floor((weekNumber - 1) / 4);
  return 1 + weeksIntoBlock * 0.07 + blockIndex * 0.12;
}

/** Rounds a distance to something a human would actually run. */
function roundMeters(meters: number, step = 100): number {
  return Math.max(step, Math.round(meters / step) * step);
}

function focusFor(weekNumber: number, buildFocus: string): string {
  return isDeload(weekNumber) ? 'Recovery and technique' : buildFocus;
}

// --- Foundation --------------------------------------------------------------

/**
 * Four training days. The priority is consistency and connective tissue, so
 * there is no interval work and the ruck stays short and light.
 */
function foundationWeek(weekNumber: number): WeekPlan {
  const factor = volumeFactor(weekNumber);
  const deload = isDeload(weekNumber);

  return {
    focus: focusFor(weekNumber, 'Aerobic base'),
    deload,
    days: [
      {
        title: 'Easy Run + Calisthenics',
        description: 'Build the aerobic engine, then basic strength.',
        sessions: [
          easyRunSession(roundMeters(3000 * factor), Math.round(24 * factor)),
          calisthenicsSession(
            [
              calisthenicsBlock('Assisted or negative pull-ups', 4, 5, 120),
              calisthenicsBlock('Push-ups', 4, 12),
              calisthenicsBlock('Sit-ups', 3, 25, 60),
            ],
            20,
          ),
        ],
      },
      {
        title: 'Swim Technique',
        description: 'Short repeats with long rests. Technique before fitness.',
        sessions: [
          poolSession('Swim Technique', [swimSet(8, 50, 45, 4), swimSet(4, 100, 60, 5)], 30),
        ],
      },
      restDay(),
      {
        title: 'Easy Run',
        description: 'Same effort, slightly further.',
        sessions: [easyRunSession(roundMeters(3600 * factor), Math.round(28 * factor))],
      },
      {
        title: 'Loaded Walk',
        description: 'Light pack, flat ground. This is preparation for rucking.',
        sessions: [ruckSession(roundMeters(3200 * factor, 400), 20, Math.round(45 * factor))],
      },
      {
        title: 'Long Aerobic',
        description: 'The most important session of the week. Keep it easy.',
        sessions: [easyRunSession(roundMeters(5000 * factor, 200), Math.round(40 * factor))],
      },
      restDay(),
    ],
  };
}

// --- Selection Prep ----------------------------------------------------------

/**
 * The primary track. Five training days plus a recovery day, balancing
 * running, water, load and calisthenics.
 */
function selectionPrepWeek(weekNumber: number): WeekPlan {
  const factor = volumeFactor(weekNumber);
  const deload = isDeload(weekNumber);
  // Interval reps grow with the block; the deload cuts them back.
  const reps = deload ? 4 : Math.min(8, 5 + Math.floor((weekNumber - 1) / 2));

  return {
    focus: focusFor(weekNumber, weekNumber <= 4 ? 'Aerobic volume' : 'Threshold and load'),
    deload,
    days: [
      {
        title: 'Interval Run + Calisthenics',
        description: 'Threshold running, then upper body.',
        sessions: [
          intervalRunSession(reps, 800, 120, 0.94, Math.round(45 * factor)),
          standardCalisthenics(5, 25, 22),
        ],
      },
      {
        title: 'Swim + Strength',
        description: 'Water endurance followed by compound strength work.',
        sessions: [
          poolSession(
            'Pool Session',
            [swimSet(6, 100, 45), swimIntervals(4, 200, 60, 1.02)],
            35,
          ),
          strengthSession(
            [
              strengthBlock('Goblet squat', 4, 8),
              strengthBlock('Romanian deadlift', 3, 8),
              strengthBlock('Overhead press', 3, 8),
            ],
            30,
          ),
        ],
      },
      recoveryDay(),
      {
        title: 'Tempo Run + Pool',
        description: 'Sustained effort on land, easy work in the water.',
        sessions: [
          tempoRunSession(roundMeters(3200 * factor), Math.round(35 * factor)),
          poolSession('Easy Swim', [swimSet(8, 100, 30, 4)], 25),
        ],
      },
      {
        title: 'Ruck',
        description: 'Steady pace under load. Do not run it.',
        sessions: [ruckSession(roundMeters(6400 * factor, 400), 35, Math.round(75 * factor))],
      },
      {
        title: 'Long Aerobic',
        description: 'Conversational pace throughout.',
        sessions: [easyRunSession(roundMeters(8000 * factor, 200), Math.round(55 * factor))],
      },
      restDay(),
    ],
  };
}

// --- Advanced ----------------------------------------------------------------

/**
 * Six training days, faster intervals and heavier load. Assumes the athlete
 * already holds a solid base across all four categories.
 */
function advancedWeek(weekNumber: number): WeekPlan {
  const factor = volumeFactor(weekNumber);
  const deload = isDeload(weekNumber);
  const reps = deload ? 5 : Math.min(10, 6 + Math.floor((weekNumber - 1) / 2));

  return {
    focus: focusFor(weekNumber, weekNumber <= 4 ? 'Speed and volume' : 'Race specific'),
    deload,
    days: [
      {
        title: 'Interval Run + Calisthenics',
        description: 'Faster repeats on short recovery.',
        sessions: [
          intervalRunSession(reps, 800, 90, 0.9, Math.round(50 * factor)),
          standardCalisthenics(6, 35, 25),
        ],
      },
      {
        title: 'Swim Intervals + Strength',
        description: 'Threshold swimming, then heavy compounds.',
        sessions: [
          poolSession(
            'Swim Intervals',
            [swimSet(4, 100, 30, 4), swimIntervals(8, 100, 30, 0.95)],
            40,
          ),
          strengthSession(
            [
              strengthBlock('Back squat', 5, 5, 8),
              strengthBlock('Deadlift', 3, 5, 8),
              strengthBlock('Weighted pull-up', 4, 5, 8),
            ],
            40,
          ),
        ],
      },
      recoveryDay(35),
      {
        title: 'Tempo Run + Pool',
        description: 'Hold the effort honest. This should feel controlled but hard.',
        sessions: [
          tempoRunSession(roundMeters(5000 * factor, 200), Math.round(42 * factor)),
          poolSession('Recovery Swim', [swimSet(10, 100, 20, 3)], 25),
        ],
      },
      {
        title: 'Heavy Ruck',
        description: 'Heavier load, same discipline on pace.',
        sessions: [ruckSession(roundMeters(9600 * factor, 400), 45, Math.round(105 * factor))],
      },
      {
        title: 'Long Aerobic + Calisthenics',
        description: 'Long run, then a short body-weight circuit.',
        sessions: [
          easyRunSession(roundMeters(12000 * factor, 200), Math.round(75 * factor)),
          standardCalisthenics(4, 30, 18),
        ],
      },
      restDay(),
    ],
  };
}

// --- Assembly ----------------------------------------------------------------

function weeksFrom(builder: (weekNumber: number) => WeekPlan): WeekPlan[] {
  return Array.from({ length: BLOCK_WEEKS }, (_, index) => builder(index + 1));
}

const TRACK_PLANS: readonly TrackPlan[] = [
  {
    trackId: 'foundation',
    name: 'Foundation',
    description:
      'Eight weeks building an aerobic base, basic calisthenics and water confidence, with load introduced gradually.',
    weeks: weeksFrom(foundationWeek),
  },
  {
    trackId: 'selection_prep',
    name: 'Selection Prep',
    description:
      'Eight weeks balancing running, swimming, rucking and calisthenics, with a deload every fourth week.',
    weeks: weeksFrom(selectionPrepWeek),
  },
  {
    trackId: 'advanced',
    name: 'Advanced',
    description:
      'Eight weeks of higher volume and faster intervals for athletes already near competitive standards.',
    weeks: weeksFrom(advancedWeek),
  },
];

const PROGRAMS_BY_TRACK = new Map<TrainingTrackId, BuiltProgram>(
  TRACK_PLANS.map((plan) => [plan.trackId, buildProgram(plan)]),
);

export function programForTrack(trackId: TrainingTrackId): BuiltProgram {
  const built = PROGRAMS_BY_TRACK.get(trackId);
  if (!built) {
    throw new Error(`No programme authored for track ${trackId}`);
  }
  return built;
}

// Adapted variants are built once per track on first use. The adaptation is
// pure over the plan, so the cache key is only which shape came out.
const ADAPTED_BY_TRACK = new Map<TrainingTrackId, BuiltProgram>();

/**
 * The programme this athlete actually trains.
 *
 * Target-aware: a Target with no swimming domain gets the land-adapted
 * variant of its track, with every swim replaced by an easy aerobic run of
 * the same duration. Everyone else gets the track as authored.
 */
export function programForAthlete(trackId: TrainingTrackId, goalId: GoalId): BuiltProgram {
  const target = findPipeline(goalId);
  const plan = TRACK_PLANS.find((candidate) => candidate.trackId === trackId);
  if (!plan) {
    throw new Error(`No programme authored for track ${trackId}`);
  }

  const adapted = adaptPlanForPipeline(plan, target);
  if (adapted === plan) {
    return programForTrack(trackId);
  }

  const cached = ADAPTED_BY_TRACK.get(trackId);
  if (cached) {
    return cached;
  }
  const built = buildProgram(adapted);
  ADAPTED_BY_TRACK.set(trackId, built);
  return built;
}

export const ALL_PROGRAMS: readonly BuiltProgram[] = [...PROGRAMS_BY_TRACK.values()];
