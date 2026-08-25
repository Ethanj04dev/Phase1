import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { ProgramPosition, ProgramSummary } from '@/data/repositories/types';
import type { ResolvedWorkoutDay } from '@/domain/training/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface TrainingWeek {
  program: ProgramSummary;
  position: ProgramPosition | null;
  /** Week actually being displayed, which may not be the current one. */
  weekNumber: number;
  focus: string;
  days: readonly ResolvedWorkoutDay[];
}

const NO_PROGRAM = {
  code: 'not_found' as const,
  message: 'We could not load your training programme.',
};

/**
 * Loads one week of the athlete's programme.
 *
 * `selectedWeek` is null on first render so the hook can default to wherever
 * the athlete actually is, rather than the screen having to know that before
 * the programme has loaded.
 */
export function useTrainingWeek(selectedWeek: number | null): AsyncResource<TrainingWeek> {
  const { athlete, training } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<TrainingWeek>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROGRAM);
    }

    const [programResult, positionResult] = await Promise.all([
      training.getProgram(profile.id),
      training.getPosition(profile.id),
    ]);

    if (!programResult.ok) return programResult;
    if (!positionResult.ok) return positionResult;
    if (!programResult.value) return err(NO_PROGRAM);

    const program = programResult.value;
    const position = positionResult.value;

    const weekNumber = Math.min(
      Math.max(1, selectedWeek ?? position?.weekNumber ?? 1),
      program.program.durationWeeks,
    );

    const daysResult = await training.getWeek(profile.id, weekNumber);
    if (!daysResult.ok) return daysResult;

    return ok({
      program,
      position,
      weekNumber,
      focus: program.weekFocus.get(weekNumber) ?? '',
      days: daysResult.value,
    });
  }, [athlete, selectedWeek, training]);

  return useAsyncResource(fetcher);
}
