import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { AssessmentResult } from '@/domain/assessment/types';
import type { ResolvedWorkoutDay } from '@/domain/training/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface WorkoutDayView {
  day: ResolvedWorkoutDay;
  /**
   * The athlete's assessment history, needed to turn the programme's declared
   * pace relationships into concrete target windows.
   */
  results: readonly AssessmentResult[];
}

const NOT_FOUND = {
  code: 'not_found' as const,
  message: 'We could not find that session.',
};

export function useWorkoutDay(dayId: string | undefined): AsyncResource<WorkoutDayView> {
  const { athlete, assessment, training } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<WorkoutDayView>> => {
    if (!dayId) {
      return err(NOT_FOUND);
    }

    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NOT_FOUND);
    }

    const [dayResult, resultsResult] = await Promise.all([
      training.getDay(profile.id, dayId),
      assessment.listResults(profile.id),
    ]);

    if (!dayResult.ok) return dayResult;
    if (!resultsResult.ok) return resultsResult;
    if (!dayResult.value) return err(NOT_FOUND);

    return ok({ day: dayResult.value, results: resultsResult.value });
  }, [assessment, athlete, dayId, training]);

  return useAsyncResource(fetcher);
}
