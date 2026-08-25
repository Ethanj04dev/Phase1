import type { TrainingTrackId } from '@/domain/athlete/types';
import type { IsoDateTime, PerformanceCategory, Uuid } from '@/domain/types';

/** What kind of work a session is. Drives iconography, grouping and scoring. */
export type SessionModality =
  | 'running'
  | 'swimming'
  | 'strength'
  | 'calisthenics'
  | 'rucking'
  | 'recovery';

export const SESSION_MODALITY_LABELS: Record<SessionModality, string> = {
  running: 'Running',
  swimming: 'Swimming',
  strength: 'Strength',
  calisthenics: 'Calisthenics',
  rucking: 'Rucking',
  recovery: 'Recovery',
};

/** Which readiness category a modality contributes to. */
export const MODALITY_CATEGORY: Record<SessionModality, PerformanceCategory | null> = {
  running: 'running',
  swimming: 'swimming',
  strength: 'strength',
  calisthenics: 'calisthenics',
  rucking: 'rucking',
  recovery: null,
};

// --- Personalised targets ---------------------------------------------------

/**
 * Which recent performance a target is derived from. Programs never hardcode
 * "6 x 400m at 1:30" -- they declare a relationship to something the athlete
 * has actually run or swum, so two athletes on the same session get different
 * numbers.
 */
export type PaceBasis =
  | 'mile_time'
  | 'one_and_half_mile_time'
  | 'five_mile_time'
  | 'swim_500_time'
  | 'ruck_pace';

export interface PaceTarget {
  basis: PaceBasis;
  /**
   * Multiplier on the basis pace. Below 1 is faster than basis pace, above 1
   * is slower. An 800m repeat at 0.94 is roughly mile pace minus 6 percent.
   */
  factor: number;
  /** Half-width of the displayed window, in seconds per repetition. */
  toleranceSeconds: number;
}

/** Effort prescription for work that is not pace-based. */
export interface EffortTarget {
  /** Rate of perceived exertion, 1-10. */
  rpe: number;
}

// --- Workout blocks ---------------------------------------------------------
//
// A discriminated union keeps interval work and barbell work in one list
// without forcing either into the other shape. In Postgres this is stored as
// (kind text, params jsonb) so adding a block type is not a migration.

interface WorkoutBlockBase {
  id: Uuid;
  order: number;
  name: string;
  notes?: string;
}

export interface IntervalBlock extends WorkoutBlockBase {
  kind: 'interval';
  reps: number;
  distanceMeters: number;
  recoverySeconds: number;
  target: PaceTarget;
}

export interface SteadyBlock extends WorkoutBlockBase {
  kind: 'steady';
  distanceMeters?: number;
  durationSeconds?: number;
  target?: PaceTarget;
  effort?: EffortTarget;
}

export interface SwimBlock extends WorkoutBlockBase {
  kind: 'swim';
  reps: number;
  distanceMeters: number;
  restSeconds: number;
  target?: PaceTarget;
  effort?: EffortTarget;
}

export interface RuckBlock extends WorkoutBlockBase {
  kind: 'ruck';
  distanceMeters: number;
  loadPounds: number;
  target?: PaceTarget;
}

export interface StrengthBlock extends WorkoutBlockBase {
  kind: 'strength';
  sets: number;
  reps: number;
  /** Prescribed load in pounds, when the program fixes it. */
  loadPounds?: number;
  restSeconds: number;
  effort?: EffortTarget;
}

export interface CalisthenicsBlock extends WorkoutBlockBase {
  kind: 'calisthenics';
  sets: number;
  /** A fixed rep count, or a set taken to technical failure. */
  reps: number | 'max';
  restSeconds: number;
}

export interface RecoveryBlock extends WorkoutBlockBase {
  kind: 'recovery';
  durationSeconds: number;
  description: string;
}

export type WorkoutBlock =
  | IntervalBlock
  | SteadyBlock
  | SwimBlock
  | RuckBlock
  | StrengthBlock
  | CalisthenicsBlock
  | RecoveryBlock;

export type WorkoutBlockKind = WorkoutBlock['kind'];

// --- Program hierarchy ------------------------------------------------------

export interface Program {
  id: Uuid;
  trackId: TrainingTrackId;
  name: string;
  description: string;
  durationWeeks: number;
  active: boolean;
}

export interface ProgramWeek {
  id: Uuid;
  programId: Uuid;
  weekNumber: number;
  /** Short editorial focus for the week, e.g. "Aerobic volume". */
  focus: string;
}

export interface WorkoutDay {
  id: Uuid;
  programWeekId: Uuid;
  /** 1 = Monday through 7 = Sunday. */
  dayNumber: number;
  title: string;
  description: string;
  restDay: boolean;
}

export interface WorkoutSession {
  id: Uuid;
  workoutDayId: Uuid;
  order: number;
  modality: SessionModality;
  title: string;
  estimatedMinutes: number;
  blocks: readonly WorkoutBlock[];
}

/** A day with its sessions resolved. What the Today screen actually renders. */
export interface ResolvedWorkoutDay extends WorkoutDay {
  sessions: readonly WorkoutSession[];
}

// --- Results ----------------------------------------------------------------

export interface WorkoutResult {
  id: Uuid;
  athleteId: Uuid;
  workoutSessionId: Uuid;
  completedAt: IsoDateTime;
  durationSeconds: number;
  /** Session-level perceived effort, 1-10. */
  rpe: number | null;
  notes: string | null;
}

export interface ExerciseResult {
  id: Uuid;
  workoutResultId: Uuid;
  workoutBlockId: Uuid;
  /** Which repetition or set this row records, 1-based. */
  repIndex: number;
  durationSeconds?: number;
  distanceMeters?: number;
  reps?: number;
  loadPounds?: number;
  rpe?: number;
}
