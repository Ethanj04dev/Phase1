import type { TrainingTrackId } from '@/domain/athlete/types';
import type {
  Program,
  ProgramWeek,
  ResolvedWorkoutDay,
  SessionModality,
  WorkoutBlock,
  WorkoutDay,
  WorkoutSession,
} from '@/domain/training/types';

/**
 * Authoring types and the builder that turns them into the domain shapes.
 *
 * Programmes are authored as plans without ids, and the builder assigns
 * deterministic ids derived from position. Deterministic matters: a logged
 * result references a block id, and those references have to survive an app
 * restart and mean the same thing on every device.
 */

export type BlockPlan =
  | Omit<Extract<WorkoutBlock, { kind: 'interval' }>, 'id' | 'order'>
  | Omit<Extract<WorkoutBlock, { kind: 'steady' }>, 'id' | 'order'>
  | Omit<Extract<WorkoutBlock, { kind: 'swim' }>, 'id' | 'order'>
  | Omit<Extract<WorkoutBlock, { kind: 'ruck' }>, 'id' | 'order'>
  | Omit<Extract<WorkoutBlock, { kind: 'strength' }>, 'id' | 'order'>
  | Omit<Extract<WorkoutBlock, { kind: 'calisthenics' }>, 'id' | 'order'>
  | Omit<Extract<WorkoutBlock, { kind: 'recovery' }>, 'id' | 'order'>;

export interface SessionPlan {
  modality: SessionModality;
  title: string;
  estimatedMinutes: number;
  blocks: readonly BlockPlan[];
}

export interface DayPlan {
  title: string;
  description: string;
  restDay?: boolean;
  sessions?: readonly SessionPlan[];
}

export interface WeekPlan {
  focus: string;
  /** Reduced volume week. Recovery is training, not time off. */
  deload?: boolean;
  /** Exactly seven, in programme order. */
  days: readonly DayPlan[];
}

export interface TrackPlan {
  trackId: TrainingTrackId;
  name: string;
  description: string;
  weeks: readonly WeekPlan[];
}

export interface BuiltProgram {
  program: Program;
  weeks: readonly ProgramWeek[];
  /** Keyed by `${weekNumber}:${dayNumber}`. */
  days: ReadonlyMap<string, ResolvedWorkoutDay>;
  weekFocus: ReadonlyMap<number, string>;
}

export function dayKey(weekNumber: number, dayNumber: number): string {
  return `${weekNumber}:${dayNumber}`;
}

export function buildProgram(plan: TrackPlan): BuiltProgram {
  const programId = `program-${plan.trackId}`;

  const weeks: ProgramWeek[] = [];
  const days = new Map<string, ResolvedWorkoutDay>();
  const weekFocus = new Map<number, string>();

  plan.weeks.forEach((weekPlan, weekIndex) => {
    const weekNumber = weekIndex + 1;
    const weekId = `${programId}-w${weekNumber}`;

    weeks.push({ id: weekId, programId, weekNumber, focus: weekPlan.focus });
    weekFocus.set(weekNumber, weekPlan.focus);

    weekPlan.days.forEach((dayPlan, dayIndex) => {
      const dayNumber = dayIndex + 1;
      const dayId = `${weekId}-d${dayNumber}`;

      const sessions: WorkoutSession[] = (dayPlan.sessions ?? []).map(
        (sessionPlan, sessionIndex) => {
          const sessionId = `${dayId}-s${sessionIndex + 1}`;
          const blocks: WorkoutBlock[] = sessionPlan.blocks.map((blockPlan, blockIndex) => ({
            ...blockPlan,
            id: `${sessionId}-b${blockIndex + 1}`,
            order: blockIndex + 1,
          }));

          return {
            id: sessionId,
            workoutDayId: dayId,
            order: sessionIndex + 1,
            modality: sessionPlan.modality,
            title: sessionPlan.title,
            estimatedMinutes: sessionPlan.estimatedMinutes,
            blocks,
          };
        },
      );

      const day: WorkoutDay & { sessions: readonly WorkoutSession[] } = {
        id: dayId,
        programWeekId: weekId,
        dayNumber,
        title: dayPlan.title,
        description: dayPlan.description,
        restDay: dayPlan.restDay ?? sessions.length === 0,
        sessions,
      };

      days.set(dayKey(weekNumber, dayNumber), day);
    });
  });

  return {
    program: {
      id: programId,
      trackId: plan.trackId,
      name: plan.name,
      description: plan.description,
      durationWeeks: plan.weeks.length,
      active: true,
    },
    weeks,
    days,
    weekFocus,
  };
}
