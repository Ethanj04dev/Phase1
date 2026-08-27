import type { SupabaseClient } from '@supabase/supabase-js';

import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { ReadinessSnapshot } from '@/domain/readiness/types';
import type { ActiveSession, ExerciseResult, WorkoutResult } from '@/domain/training/types';
import { err, ok, type DomainError, type Result } from '@/domain/types';

import { createContentTrainingRepository } from '@/data/content/trainingRepository';
import { localWorkoutRepository as localDraftStore } from '@/data/local/workoutRepository';
import type {
  AssessmentRepository,
  AthleteRepository,
  MilestoneRepository,
  ProficiencyRepository,
  ReadinessRepository,
  Repositories,
  WorkoutRepository,
} from '@/data/repositories/types';

import { friendlyMessage } from './client';
import {
  toAssessmentResult,
  toAthleteProfile,
  toExerciseResult,
  toMilestoneCompletion,
  toProficiencyRating,
  toReadinessSnapshot,
  toWorkoutResult,
  type AssessmentResultRow,
  type AthleteProfileRow,
  type ExerciseResultRow,
  type MilestoneCompletionRow,
  type ProficiencyRatingRow,
  type ReadinessScoreRow,
  type WorkoutResultRow,
} from './rows';

/**
 * Supabase-backed repositories.
 *
 * Same interfaces as the local implementation, so no screen changes when this
 * takes over. Ownership is enforced by row-level security rather than by
 * filtering here: every query still scopes by athlete_id for index selectivity,
 * but the database would refuse a cross-athlete read regardless.
 */

function failure(fallback: string, cause: unknown): Result<never> {
  const error: DomainError = {
    code: 'network',
    message: friendlyMessage(fallback, cause),
    cause,
  };
  return err(error);
}

const NOT_FOUND: DomainError = {
  code: 'not_found',
  message: 'We could not find your athlete profile.',
};

export function createSupabaseRepositories(client: SupabaseClient): Repositories {
  async function currentUserId(): Promise<string | null> {
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  }

  const athlete: AthleteRepository = {
    getCurrentProfile: async () => {
      const userId = await currentUserId();
      if (!userId) {
        return ok(null);
      }

      const { data, error } = await client
        .from('athlete_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return failure('We could not load your profile.', error);
      }
      return ok(data ? toAthleteProfile(data as AthleteProfileRow) : null);
    },

    createProfile: async (input) => {
      const userId = await currentUserId();
      if (!userId) {
        return err({ code: 'unauthorized', message: 'You need to sign in first.' });
      }

      const { data, error } = await client
        .from('athlete_profiles')
        .insert({
          user_id: userId,
          display_name: input.displayName,
          goal_id: input.goalId,
          track_id: input.trackId,
          running_experience: input.runningExperience,
          swimming_experience: input.swimmingExperience,
          rucking_experience: input.ruckingExperience,
          training_days_per_week: input.trainingDaysPerWeek,
          onboarding_completed: input.onboardingCompleted,
        })
        .select('*')
        .single();

      if (error) {
        return failure('We could not save your profile.', error);
      }
      return ok(toAthleteProfile(data as AthleteProfileRow));
    },

    updateProfile: async (id, patch) => {
      const row: Record<string, unknown> = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.goalId !== undefined) row.goal_id = patch.goalId;
      if (patch.trackId !== undefined) row.track_id = patch.trackId;
      if (patch.runningExperience !== undefined)
        row.running_experience = patch.runningExperience;
      if (patch.swimmingExperience !== undefined)
        row.swimming_experience = patch.swimmingExperience;
      if (patch.ruckingExperience !== undefined)
        row.rucking_experience = patch.ruckingExperience;
      if (patch.trainingDaysPerWeek !== undefined)
        row.training_days_per_week = patch.trainingDaysPerWeek;
      if (patch.onboardingCompleted !== undefined)
        row.onboarding_completed = patch.onboardingCompleted;

      const { data, error } = await client
        .from('athlete_profiles')
        .update(row)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return failure('We could not save your changes.', error);
      }
      return ok(toAthleteProfile(data as AthleteProfileRow));
    },
  };

  const assessment: AssessmentRepository = {
    listResults: async (athleteId, options) => {
      let query = client
        .from('assessment_results')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('recorded_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.before) {
        query = query.lt('recorded_at', options.before);
      }

      const { data, error } = await query;
      if (error) {
        return failure('We could not load your results.', error);
      }
      return ok((data as AssessmentResultRow[]).map(toAssessmentResult));
    },

    recordResults: async (athleteId, entries) => {
      if (entries.length === 0) {
        return ok([]);
      }
      // One timestamp for the batch: these performances happened at the same
      // sitting, and sharing an instant keeps history grouped correctly.
      const recordedAt = new Date().toISOString();

      const { data, error } = await client
        .from('assessment_results')
        .insert(
          entries.map((entry) => ({
            athlete_id: athleteId,
            event_id: entry.eventId,
            value: entry.value,
            recorded_at: recordedAt,
            notes: entry.notes ?? null,
          })),
        )
        .select('*');

      if (error) {
        return failure('We could not save your results.', error);
      }
      return ok((data as AssessmentResultRow[]).map(toAssessmentResult));
    },
  };

  const proficiency: ProficiencyRepository = {
    listRatings: async (athleteId, options) => {
      let query = client
        .from('proficiency_ratings')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('recorded_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) {
        return failure('We could not load your skill ratings.', error);
      }
      return ok((data as ProficiencyRatingRow[]).map(toProficiencyRating));
    },

    recordRatings: async (athleteId, entries) => {
      if (entries.length === 0) {
        return ok([]);
      }
      const recordedAt = new Date().toISOString();

      const { data, error } = await client
        .from('proficiency_ratings')
        .insert(
          entries.map((entry) => ({
            athlete_id: athleteId,
            domain_id: entry.domainId,
            skill_id: entry.skillId,
            level: entry.level,
            recorded_at: recordedAt,
            notes: entry.notes ?? null,
          })),
        )
        .select('*');

      if (error) {
        return failure('We could not save your skill ratings.', error);
      }
      return ok((data as ProficiencyRatingRow[]).map(toProficiencyRating));
    },
  };

  const milestone: MilestoneRepository = {
    listCompletions: async (athleteId) => {
      const { data, error } = await client
        .from('milestone_completions')
        .select('*')
        .eq('athlete_id', athleteId);

      if (error) {
        return failure('We could not load your milestones.', error);
      }
      return ok((data as MilestoneCompletionRow[]).map(toMilestoneCompletion));
    },

    setCompleted: async (athleteId, milestoneId, completed) => {
      if (!completed) {
        const { error } = await client
          .from('milestone_completions')
          .delete()
          .eq('athlete_id', athleteId)
          .eq('milestone_id', milestoneId);

        return error ? failure('We could not update your milestone.', error) : ok(undefined);
      }

      // Upsert on the unique pair, so a double tap cannot create two rows and
      // marking something already done is a no-op rather than an error.
      const { error } = await client.from('milestone_completions').upsert(
        {
          athlete_id: athleteId,
          milestone_id: milestoneId,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'athlete_id,milestone_id' },
      );

      return error ? failure('We could not update your milestone.', error) : ok(undefined);
    },
  };

  const readiness: ReadinessRepository = {
    getLatest: async (athleteId) => {
      const { data, error } = await client
        .from('readiness_scores')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return failure('We could not load your readiness score.', error);
      }
      return ok(data ? toReadinessSnapshot(data as ReadinessScoreRow) : null);
    },

    getTrend: async (athleteId, windowDays) => {
      const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();

      const { data, error } = await client
        .from('readiness_scores')
        .select('*')
        .eq('athlete_id', athleteId)
        .gte('recorded_at', cutoff)
        .order('recorded_at', { ascending: true });

      if (error) {
        return failure('We could not load your readiness trend.', error);
      }

      const rows = (data as ReadinessScoreRow[]).map(toReadinessSnapshot);
      const oldest = rows[0];
      const newest = rows[rows.length - 1];

      // One snapshot inside the window has nothing to compare against.
      if (!oldest || !newest || oldest === newest) {
        return ok({ delta: 0, windowDays, comparedTo: null });
      }
      return ok({
        delta: newest.overall - oldest.overall,
        windowDays,
        comparedTo: oldest.recordedAt,
      });
    },

    listHistory: async (athleteId, options) => {
      let query = client
        .from('readiness_scores')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('recorded_at', { ascending: false });

      if (options?.limit) query = query.limit(options.limit);
      if (options?.before) query = query.lt('recorded_at', options.before);

      const { data, error } = await query;
      if (error) {
        return failure('We could not load your readiness history.', error);
      }
      return ok((data as ReadinessScoreRow[]).map(toReadinessSnapshot));
    },

    record: async (athleteId, calculation) => {
      const { data, error } = await client
        .from('readiness_scores')
        .insert({
          athlete_id: athleteId,
          overall: calculation.overall,
          categories: calculation.categories,
          strongest_category: calculation.strongestCategory,
          priority_category: calculation.priorityCategory,
          coverage: calculation.coverage,
          benchmark_version: calculation.benchmarkVersion,
          target_readiness: calculation.target,
        })
        .select('*')
        .single();

      if (error) {
        return failure('We could not save your readiness score.', error);
      }
      return ok(toReadinessSnapshot(data as ReadinessScoreRow));
    },
  };

  const workout: WorkoutRepository = {
    // The in-progress session stays on the device. It changes on every logged
    // rep, often with no signal, and it is meaningless to any other device.
    // Only the finished result is worth a round trip.
    getActive: (athleteId) => localDraftStore.getActive(athleteId),
    saveActive: (session: ActiveSession) => localDraftStore.saveActive(session),
    discardActive: (athleteId) => localDraftStore.discardActive(athleteId),

    complete: async (session, durationSeconds) => {
      const { data, error } = await client
        .from('workout_results')
        .insert({
          athlete_id: session.athleteId,
          workout_day_id: session.workoutDayId,
          duration_seconds: durationSeconds,
          rpe: session.rpe,
          notes: session.notes.trim().length > 0 ? session.notes.trim() : null,
          distance_meters: session.entries.reduce(
            (total, entry) => total + (entry.distanceMeters ?? 0),
            0,
          ),
        })
        .select('*')
        .single();

      if (error) {
        return failure('We could not save your session.', error);
      }
      const result = toWorkoutResult(data as WorkoutResultRow);

      if (session.entries.length > 0) {
        const { error: rowsError } = await client.from('exercise_results').insert(
          session.entries.map((entry) => ({
            workout_result_id: result.id,
            workout_block_id: entry.blockId,
            rep_index: entry.repIndex,
            duration_seconds: entry.durationSeconds ?? null,
            distance_meters: entry.distanceMeters ?? null,
            reps: entry.reps ?? null,
            load_pounds: entry.loadPounds ?? null,
            rpe: entry.rpe ?? null,
          })),
        );

        if (rowsError) {
          // The parent row exists but its detail does not. Leave the local
          // draft in place so the athlete can retry rather than losing the
          // rep-by-rep record they just spent an hour producing.
          return failure('We could not save your session detail.', rowsError);
        }
      }

      await localDraftStore.discardActive(session.athleteId);
      return ok(result);
    },

    listResults: async (athleteId, options) => {
      let query = client
        .from('workout_results')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('completed_at', { ascending: false });

      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) {
        return failure('We could not load your workouts.', error);
      }
      return ok((data as WorkoutResultRow[]).map(toWorkoutResult));
    },

    listExerciseResults: async (workoutResultId) => {
      const { data, error } = await client
        .from('exercise_results')
        .select('*')
        .eq('workout_result_id', workoutResultId)
        .order('rep_index', { ascending: true });

      if (error) {
        return failure('We could not load your session detail.', error);
      }
      return ok((data as ExerciseResultRow[]).map(toExerciseResult));
    },
  };

  return {
    athlete,
    assessment,
    milestone,
    proficiency,
    readiness,
    workout,
    // Programme content ships with the app; only the athlete's position in it
    // is personal. Nothing to fetch.
    training: createContentTrainingRepository(athlete.getCurrentProfile, workout),
  };
}

export type {
  AssessmentResult,
  AthleteProfile,
  ExerciseResult,
  ReadinessSnapshot,
  WorkoutResult,
};
export { NOT_FOUND };
