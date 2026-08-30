import type { SupabaseClient } from '@supabase/supabase-js';

import { readRecord, StorageKeys } from '@/data/local/storage';
import { createSupabaseRepositories } from '@/data/supabase/supabaseRepositories';
import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { AssessmentAttempt } from '@/domain/attempt/types';
import type { CandidateProfile } from '@/domain/candidate/types';
import type { ReadinessSnapshot } from '@/domain/readiness/types';
import type { WorkoutResult } from '@/domain/training/types';

export interface MigrationOutcome {
  migrated: boolean;
  profile: boolean;
  candidate: boolean;
  attempts: number;
  /**
   * Set when the locally chosen handle was already claimed by someone else.
   * The rest of the migration still succeeds; the athlete picks a new handle
   * from the profile screen. Losing a handle race must not cost the history.
   */
  handleConflict: boolean;
  assessments: number;
  snapshots: number;
  workouts: number;
  error: string | null;
}

const NOTHING_TO_DO: MigrationOutcome = {
  migrated: false,
  profile: false,
  candidate: false,
  attempts: 0,
  handleConflict: false,
  assessments: 0,
  snapshots: 0,
  workouts: 0,
  error: null,
};

/**
 * Moves data created before sign-in into the athlete's account.
 *
 * The rules that make this safe:
 *
 * - It only runs when the account has NO profile yet. An account that already
 *   holds data is never merged into, because there is no correct way to
 *   reconcile two histories and guessing would corrupt both.
 * - Local records are copied, not moved. Nothing is deleted until the upload
 *   has succeeded, so a failure halfway leaves the athlete exactly as they
 *   were rather than with neither copy.
 * - Exercise-level rows are not migrated. They reference workout results by an
 *   id that changes on insert, and the summary on each workout result already
 *   carries what the charts need. Recreating the per-rep detail would mean
 *   remapping ids for data the athlete cannot see anyway.
 */
export async function migrateLocalData(client: SupabaseClient): Promise<MigrationOutcome> {
  const repositories = createSupabaseRepositories(client);

  const remote = await repositories.athlete.getCurrentProfile();
  if (!remote.ok) {
    return { ...NOTHING_TO_DO, error: remote.error.message };
  }
  if (remote.value) {
    // The account already has a profile. Leave both sides alone.
    return NOTHING_TO_DO;
  }

  const localProfile = await readRecord<AthleteProfile>(StorageKeys.athleteProfile);
  if (!localProfile.ok || !localProfile.value) {
    return NOTHING_TO_DO;
  }
  const profile = localProfile.value;

  const created = await repositories.athlete.createProfile({
    displayName: profile.displayName,
    goalId: profile.goalId,
    trackId: profile.trackId,
    runningExperience: profile.runningExperience,
    swimmingExperience: profile.swimmingExperience,
    ruckingExperience: profile.ruckingExperience,
    selectionDate: profile.selectionDate ?? null,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    onboardingCompleted: profile.onboardingCompleted,
  });
  if (!created.ok) {
    return { ...NOTHING_TO_DO, error: created.error.message };
  }
  const athleteId = created.value.id;

  const outcome: MigrationOutcome = { ...NOTHING_TO_DO, migrated: true, profile: true };

  // The candidate identity travels with the training data. A handle that was
  // free on-device can be taken by the time the account exists; that is a
  // conflict to surface, never a reason to drop the athlete's history.
  const localCandidate = await readRecord<CandidateProfile>(StorageKeys.candidateProfile);
  if (localCandidate.ok && localCandidate.value) {
    const existingCandidate = await repositories.candidate.getMine();
    if (existingCandidate.ok && !existingCandidate.value) {
      const claimed = await repositories.candidate.create({
        handle: localCandidate.value.handle,
        displayHandle: localCandidate.value.displayHandle,
        displayName: localCandidate.value.displayName,
        pipelineId: localCandidate.value.pipelineId,
        stateCode: localCandidate.value.stateCode,
        visibility: localCandidate.value.visibility,
        bio: localCandidate.value.bio,
        avatarUrl: null,
      });
      if (claimed.ok) {
        outcome.candidate = true;
      } else if (claimed.error.code === 'conflict') {
        outcome.handleConflict = true;
      } else {
        return { ...outcome, error: 'Your candidate identity could not be transferred.' };
      }
    }
  }

  const localResults = await readRecord<AssessmentResult[]>(StorageKeys.assessmentResults);
  if (localResults.ok && localResults.value?.length) {
    // Inserted directly rather than through recordResults, because that helper
    // stamps a fresh timestamp and these performances happened in the past.
    const { error } = await client.from('assessment_results').insert(
      localResults.value.map((result) => ({
        athlete_id: athleteId,
        event_id: result.eventId,
        value: result.value,
        recorded_at: result.recordedAt,
        notes: result.notes,
      })),
    );
    if (error) {
      return { ...outcome, error: 'Some of your results could not be transferred.' };
    }
    outcome.assessments = localResults.value.length;
  }

  const localSnapshots = await readRecord<ReadinessSnapshot[]>(StorageKeys.readinessSnapshots);
  if (localSnapshots.ok && localSnapshots.value?.length) {
    const { error } = await client.from('readiness_scores').insert(
      localSnapshots.value.map((snapshot) => ({
        athlete_id: athleteId,
        recorded_at: snapshot.recordedAt,
        overall: snapshot.overall,
        categories: snapshot.categories,
        strongest_category: snapshot.strongestCategory,
        priority_category: snapshot.priorityCategory,
        coverage: snapshot.coverage,
        benchmark_version: snapshot.benchmarkVersion,
      })),
    );
    if (error) {
      return { ...outcome, error: 'Some of your readiness history could not be transferred.' };
    }
    outcome.snapshots = localSnapshots.value.length;
  }

  // Assessment attempts move as they are: self-reported, with their original
  // occurrence dates and estimates. Each attempt inserts its header row and
  // then its event rows; a failure stops the count where it stands.
  const localAttempts = await readRecord<AssessmentAttempt[]>(StorageKeys.assessmentAttempts);
  if (localAttempts.ok && localAttempts.value?.length) {
    for (const item of localAttempts.value) {
      const { data, error } = await client
        .from('assessment_attempts')
        .insert({
          athlete_id: athleteId,
          definition_id: item.definitionId,
          definition_version: item.definitionVersion,
          pipeline_id: item.pipelineId,
          status: item.status,
          occurred_at: item.occurredAt,
          started_at: item.startedAt,
          completed_at: item.completedAt,
          estimated_rating: item.estimatedRating,
          scoring_config_version: item.scoringConfigVersion,
          notes: item.notes,
        })
        .select('id')
        .single();
      if (error || !data) {
        return { ...outcome, error: 'Some of your assessments could not be transferred.' };
      }
      const { error: eventsError } = await client.from('attempt_event_results').insert(
        item.results.map((result) => ({
          attempt_id: (data as { id: string }).id,
          event_id: result.eventId,
          value: result.value,
          event_order: result.order,
        })),
      );
      if (eventsError) {
        return { ...outcome, error: 'Some of your assessments could not be transferred.' };
      }
      outcome.attempts += 1;
    }
  }

  const localWorkouts = await readRecord<WorkoutResult[]>(StorageKeys.workoutResults);
  if (localWorkouts.ok && localWorkouts.value?.length) {
    const { error } = await client.from('workout_results').insert(
      localWorkouts.value.map((result) => ({
        athlete_id: athleteId,
        workout_day_id: result.workoutDayId,
        completed_at: result.completedAt,
        duration_seconds: result.durationSeconds,
        rpe: result.rpe,
        notes: result.notes,
        distance_meters: result.distanceMeters ?? 0,
      })),
    );
    if (error) {
      return { ...outcome, error: 'Some of your workouts could not be transferred.' };
    }
    outcome.workouts = localWorkouts.value.length;
  }

  return outcome;
}
