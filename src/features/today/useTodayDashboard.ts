import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { ProgramPosition } from '@/data/repositories/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import type { Goal } from '@/domain/goals/types';
import type { ReadinessSnapshot, ReadinessTrend } from '@/domain/readiness/types';
import type { ResolvedWorkoutDay } from '@/domain/training/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

/** Everything the Today screen renders, resolved in one pass. */
export interface TodayDashboard {
  profile: AthleteProfile;
  goal: Goal;
  readiness: ReadinessSnapshot | null;
  trend: ReadinessTrend | null;
  position: ProgramPosition | null;
  today: ResolvedWorkoutDay | null;
  streakDays: number;
  weeklyCompletion: number;
}

const READINESS_TREND_WINDOW_DAYS = 30;

const NO_PROFILE_ERROR = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

/**
 * Composes the dashboard from several repository calls.
 *
 * The calls run in parallel and the first failure wins, so the screen shows a
 * single coherent error rather than four partial states.
 */
export function useTodayDashboard(): AsyncResource<TodayDashboard> {
  const { athlete, readiness, training } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<TodayDashboard>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE_ERROR);
    }

    const [latest, trend, position, today, streak, completion] = await Promise.all([
      readiness.getLatest(profile.id),
      readiness.getTrend(profile.id, READINESS_TREND_WINDOW_DAYS),
      training.getPosition(profile.id),
      training.getToday(profile.id),
      training.getStreakDays(profile.id),
      training.getWeeklyCompletion(profile.id),
    ]);

    for (const result of [latest, trend, position, today, streak, completion]) {
      if (!result.ok) {
        return result;
      }
    }

    // The loop above proves every result succeeded, but TypeScript cannot
    // narrow across a heterogeneous array, so each is re-checked cheaply here.
    if (!latest.ok || !trend.ok || !position.ok || !today.ok || !streak.ok || !completion.ok) {
      return err(NO_PROFILE_ERROR);
    }

    return ok({
      profile,
      goal: getGoalOrDefault(profile.goalId),
      readiness: latest.value,
      trend: trend.value,
      position: position.value,
      today: today.value,
      streakDays: streak.value,
      weeklyCompletion: completion.value,
    });
  }, [athlete, readiness, training]);

  return useAsyncResource(fetcher);
}
