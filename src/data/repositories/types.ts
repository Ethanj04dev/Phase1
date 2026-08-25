import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { ReadinessSnapshot, ReadinessTrend } from '@/domain/readiness/types';
import type { ResolvedWorkoutDay } from '@/domain/training/types';
import type { IsoDate, Result, Uuid } from '@/domain/types';

/**
 * Repository interfaces are the seam between the UI and wherever data
 * actually lives. Screens depend on these types only, so the mock
 * implementation can be replaced by Supabase without touching a component.
 *
 * Every method returns a Result rather than throwing, which forces each call
 * site to handle the failure path explicitly.
 */

export interface AthleteRepository {
  getCurrentProfile(): Promise<Result<AthleteProfile | null>>;
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
}

export interface ProgramPosition {
  weekNumber: number;
  dayNumber: number;
  weekFocus: string;
}

export interface TrainingRepository {
  getToday(athleteId: Uuid): Promise<Result<ResolvedWorkoutDay | null>>;
  getPosition(athleteId: Uuid): Promise<Result<ProgramPosition | null>>;
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
}

export interface Repositories {
  athlete: AthleteRepository;
  assessment: AssessmentRepository;
  readiness: ReadinessRepository;
  training: TrainingRepository;
}
