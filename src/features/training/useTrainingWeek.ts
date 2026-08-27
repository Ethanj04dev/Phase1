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
  /**
   * Day ids with a finished workout against them.
   *
   * The whole history rather than this week's, because the week selector
   * moves and refetching per week would make paging back through a programme
   * feel like loading a website.
   */
  completedDayIds: ReadonlySet<string>;
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
  const { athlete, training, workout } = useRepositories();

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

    const [daysResult, workoutsResult] = await Promise.all([
      training.getWeek(profile.id, weekNumber),
      workout.listResults(profile.id),
    ]);
    if (!daysResult.ok) return daysResult;

    // Workout history only decorates the week with what was logged. Losing it
    // should grey out the state markers, not the programme.
    const completedDayIds = new Set(
      workoutsResult.ok ? workoutsResult.value.map((result) => result.workoutDayId) : [],
    );

    return ok({
      program,
      position,
      weekNumber,
      focus: program.weekFocus.get(weekNumber) ?? '',
      days: daysResult.value,
      completedDayIds,
    });
  }, [athlete, selectedWeek, training, workout]);

  return useAsyncResource(fetcher);
}
