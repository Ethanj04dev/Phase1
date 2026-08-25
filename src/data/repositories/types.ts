import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type {
  ReadinessCalculation,
  ReadinessSnapshot,
  ReadinessTrend,
} from '@/domain/readiness/types';
import type {
  ActiveSession,
  ExerciseResult,
  Program,
  ResolvedWorkoutDay,
  WorkoutResult,
} from '@/domain/training/types';
import type { IsoDate, Result, Uuid } from '@/domain/types';

/**
 * Repository interfaces are the seam between the UI and wherever data
 * actually lives. Screens depend on these types only, so the mock
 * implementation can be replaced by Supabase without touching a component.
 *
 * Every method returns a Result rather than throwing, which forces each call
 * site to handle the failure path explicitly.
 */

/** Fields onboarding supplies. Identity and timestamps are the repository's job. */
export type NewAthleteProfile = Omit<
  AthleteProfile,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

export interface AthleteRepository {
  getCurrentProfile(): Promise<Result<AthleteProfile | null>>;
  createProfile(input: NewAthleteProfile): Promise<Result<AthleteProfile>>;
  updateProfile(
    id: Uuid,
    patch: Partial<Omit<AthleteProfile, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<Result<AthleteProfile>>;
}

export interface ReadinessRepository {
  getLatest(athleteId: Uuid): Promise<Result<ReadinessSnapshot | null>>;
  getTrend(athleteId: Uuid, windowDays: number): Promise<Result<ReadinessTrend | null>>;
  /** Newest first. Paged so history never loads in full. */
  listHistory(
    athleteId: Uuid,
    options?: { limit?: number; before?: IsoDate },
  ): Promise<Result<readonly ReadinessSnapshot[]>>;
  /**
   * Appends a snapshot. Takes a finished calculation rather than raw results:
   * scoring is the domain layer's job, storage is the repository's.
   */
  record(
    athleteId: Uuid,
    calculation: ReadinessCalculation,
  ): Promise<Result<ReadinessSnapshot>>;
}

export interface ProgramPosition {
  weekNumber: number;
  dayNumber: number;
  weekFocus: string;
}

/** The athlete's programme with enough metadata to render a week selector. */
export interface ProgramSummary {
  program: Program;
  /** Week number to editorial focus. */
  weekFocus: ReadonlyMap<number, string>;
}

export interface TrainingRepository {
  getToday(athleteId: Uuid): Promise<Result<ResolvedWorkoutDay | null>>;
  getPosition(athleteId: Uuid): Promise<Result<ProgramPosition | null>>;
  getProgram(athleteId: Uuid): Promise<Result<ProgramSummary | null>>;
  /** Every day of one programme week, in order. */
  getWeek(
    athleteId: Uuid,
    weekNumber: number,
  ): Promise<Result<readonly ResolvedWorkoutDay[]>>;
  getDay(athleteId: Uuid, dayId: string): Promise<Result<ResolvedWorkoutDay | null>>;
  /** Fraction of this week completed, 0-1. */
  getWeeklyCompletion(athleteId: Uuid): Promise<Result<number>>;
  getStreakDays(athleteId: Uuid): Promise<Result<number>>;
}

export interface AssessmentRepository {
  /**
   * Every recorded performance for the athlete. Append-only history, so this
   * grows without bound and gains paging options before it reaches the UI in
   * anger.
   */
  listResults(
    athleteId: Uuid,
    options?: { limit?: number; before?: IsoDate },
  ): Promise<Result<readonly AssessmentResult[]>>;
  /**
   * Appends a batch of results recorded at the same sitting. A batch rather
   * than one call per event, so a baseline test is a single atomic write and
   * cannot half-succeed.
   */
  recordResults(
    athleteId: Uuid,
    entries: readonly NewAssessmentResult[],
  ): Promise<Result<readonly AssessmentResult[]>>;
}

/** One measured performance, before it has an id or a timestamp. */
export interface NewAssessmentResult {
  eventId: AssessmentEventId;
  value: number;
  notes?: string | null;
}

export interface WorkoutRepository {
  /**
   * The single session in progress, if any.
   *
   * There is deliberately at most one: an athlete is doing one workout at a
   * time, and allowing several would mean reconciling conflicting timers.
   */
  getActive(athleteId: Uuid): Promise<Result<ActiveSession | null>>;
  /** Persists the whole session. Called on every change, not just at the end. */
  saveActive(session: ActiveSession): Promise<Result<ActiveSession>>;
  discardActive(athleteId: Uuid): Promise<Result<void>>;
  /** Writes the finished session and its per-rep rows, then clears the draft. */
  complete(
    session: ActiveSession,
    durationSeconds: number,
  ): Promise<Result<WorkoutResult>>;
  listResults(
    athleteId: Uuid,
    options?: { limit?: number },
  ): Promise<Result<readonly WorkoutResult[]>>;
  listExerciseResults(
    workoutResultId: Uuid,
  ): Promise<Result<readonly ExerciseResult[]>>;
}

export interface Repositories {
  athlete: AthleteRepository;
  assessment: AssessmentRepository;
  readiness: ReadinessRepository;
  training: TrainingRepository;
  workout: WorkoutRepository;
}
