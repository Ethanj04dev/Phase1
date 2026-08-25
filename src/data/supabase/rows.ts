import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile, TrainingTrackId } from '@/domain/athlete/types';
import type { GoalId } from '@/domain/goals/types';
import type { ReadinessSnapshot } from '@/domain/readiness/types';
import type { ExerciseResult, WorkoutResult } from '@/domain/training/types';
import type { CategoryScores, ExperienceLevel, PerformanceCategory } from '@/domain/types';

/**
 * Row shapes and the mapping to domain objects.
 *
 * Postgres speaks snake_case and the domain speaks camelCase. Keeping the
 * translation in one file means the repositories read as business logic rather
 * than as column plumbing, and there is exactly one place to look when a
 * column is renamed.
 */

export interface AthleteProfileRow {
  id: string;
  user_id: string;
  display_name: string;
  goal_id: string;
  track_id: string;
  running_experience: string;
  swimming_experience: string;
  rucking_experience: string;
  training_days_per_week: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export function toAthleteProfile(row: AthleteProfileRow): AthleteProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    // The database stores these as text on purpose so adding a pipeline is a
    // code change. The app owns the catalog and validates on read.
    goalId: row.goal_id as GoalId,
    trackId: row.track_id as TrainingTrackId,
    runningExperience: row.running_experience as ExperienceLevel,
    swimmingExperience: row.swimming_experience as ExperienceLevel,
    ruckingExperience: row.rucking_experience as ExperienceLevel,
    trainingDaysPerWeek: row.training_days_per_week,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AssessmentResultRow {
  id: string;
  athlete_id: string;
  event_id: string;
  value: number;
  recorded_at: string;
  notes: string | null;
}

export function toAssessmentResult(row: AssessmentResultRow): AssessmentResult {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    eventId: row.event_id as AssessmentEventId,
    value: Number(row.value),
    recordedAt: row.recorded_at,
    notes: row.notes,
  };
}

export interface ReadinessScoreRow {
  id: string;
  athlete_id: string;
  recorded_at: string;
  overall: number;
  categories: Record<string, number>;
  strongest_category: string | null;
  priority_category: string | null;
  coverage: number;
  benchmark_version: number;
}

export function toReadinessSnapshot(row: ReadinessScoreRow): ReadinessSnapshot {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    recordedAt: row.recorded_at,
    overall: row.overall,
    categories: (row.categories ?? {}) as CategoryScores,
    strongestCategory: (row.strongest_category as PerformanceCategory | null) ?? null,
    priorityCategory: (row.priority_category as PerformanceCategory | null) ?? null,
    coverage: Number(row.coverage),
    benchmarkVersion: row.benchmark_version,
  };
}

export interface WorkoutResultRow {
  id: string;
  athlete_id: string;
  workout_day_id: string;
  completed_at: string;
  duration_seconds: number;
  rpe: number | null;
  notes: string | null;
  distance_meters: number | null;
}

export function toWorkoutResult(row: WorkoutResultRow): WorkoutResult {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    workoutDayId: row.workout_day_id,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    rpe: row.rpe,
    notes: row.notes,
    distanceMeters: Number(row.distance_meters ?? 0),
  };
}

export interface ExerciseResultRow {
  id: string;
  workout_result_id: string;
  workout_block_id: string;
  rep_index: number;
  duration_seconds: number | null;
  distance_meters: number | null;
  reps: number | null;
  load_pounds: number | null;
  rpe: number | null;
}

export function toExerciseResult(row: ExerciseResultRow): ExerciseResult {
  return {
    id: row.id,
    workoutResultId: row.workout_result_id,
    workoutBlockId: row.workout_block_id,
    repIndex: row.rep_index,
    // Optional fields are omitted rather than set to undefined explicitly, so
    // the object matches one built locally and comparisons stay predictable.
    ...(row.duration_seconds === null ? {} : { durationSeconds: Number(row.duration_seconds) }),
    ...(row.distance_meters === null ? {} : { distanceMeters: Number(row.distance_meters) }),
    ...(row.reps === null ? {} : { reps: row.reps }),
    ...(row.load_pounds === null ? {} : { loadPounds: Number(row.load_pounds) }),
    ...(row.rpe === null ? {} : { rpe: row.rpe }),
  };
}
