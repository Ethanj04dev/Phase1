import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { AssessmentResult } from '@/domain/assessment/types';
import { verdictFor } from '@/domain/training/session';
import { resolvePaceTarget } from '@/domain/training/targets';
import type {
  ExerciseResult,
  ResolvedWorkoutDay,
  WorkoutBlock,
  WorkoutResult,
} from '@/domain/training/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface WorkoutSummaryView {
  result: WorkoutResult;
  day: ResolvedWorkoutDay | null;
  entries: readonly ExerciseResult[];
  distanceMeters: number;
  onTarget: number;
  targeted: number;
  prescribedEntries: number;
}

const NOT_FOUND = {
  code: 'not_found' as const,
  message: 'We could not find that session.',
};

function repDistance(block: WorkoutBlock): number | null {
  switch (block.kind) {
    case 'interval':
    case 'swim':
    case 'ruck':
      return block.distanceMeters;
    case 'steady':
      return block.distanceMeters ?? null;
    default:
      return null;
  }
}

function expectedReps(block: WorkoutBlock): number {
  switch (block.kind) {
    case 'interval':
    case 'swim':
      return block.reps;
    case 'strength':
    case 'calisthenics':
      return block.sets;
    default:
      return 1;
  }
}

/**
 * Rebuilds a finished session's summary from stored records.
 *
 * Reading it back rather than passing it through navigation means the screen
 * survives a reload and shows exactly what was persisted, not what the
 * previous screen believed it had saved.
 */
export function useWorkoutSummary(
  resultId: string | undefined,
): AsyncResource<WorkoutSummaryView> {
  const { athlete, assessment, training, workout } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<WorkoutSummaryView>> => {
    if (!resultId) {
      return err(NOT_FOUND);
    }

    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) return profileResult;
    if (!profileResult.value) return err(NOT_FOUND);
    const profile = profileResult.value;

    const resultsOutcome = await workout.listResults(profile.id);
    if (!resultsOutcome.ok) return resultsOutcome;

    const result = resultsOutcome.value.find((row) => row.id === resultId);
    if (!result) {
      return err(NOT_FOUND);
    }

    const [entriesOutcome, dayOutcome, assessmentsOutcome] = await Promise.all([
      workout.listExerciseResults(result.id),
      training.getDay(profile.id, result.workoutSessionId),
      assessment.listResults(profile.id),
    ]);

    if (!entriesOutcome.ok) return entriesOutcome;
    if (!dayOutcome.ok) return dayOutcome;

    const entries = entriesOutcome.value;
    const day = dayOutcome.value;
    const athleteResults: readonly AssessmentResult[] = assessmentsOutcome.ok
      ? assessmentsOutcome.value
      : [];

    const blocks = day?.sessions.flatMap((session) => session.blocks) ?? [];
    const blockById = new Map(blocks.map((block) => [block.id, block]));

    let distanceMeters = 0;
    let onTarget = 0;
    let targeted = 0;

    for (const entry of entries) {
      if (entry.distanceMeters !== undefined) {
        distanceMeters += entry.distanceMeters;
      }

      const block = blockById.get(entry.workoutBlockId);
      if (!block || entry.durationSeconds === undefined) continue;
      if (!('target' in block) || !block.target) continue;

      const distance = repDistance(block);
      if (!distance) continue;

      const target = resolvePaceTarget(block.target, distance, athleteResults);
      if (!target) continue;

      targeted += 1;
      if (verdictFor(target, entry.durationSeconds) === 'on_target') {
        onTarget += 1;
      }
    }

    return ok({
      result,
      day,
      entries,
      distanceMeters,
      onTarget,
      targeted,
      prescribedEntries: blocks.reduce((total, block) => total + expectedReps(block), 0),
    });
  }, [assessment, athlete, resultId, training, workout]);

  return useAsyncResource(fetcher);
}
