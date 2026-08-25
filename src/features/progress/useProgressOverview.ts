import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { ProgramPosition, ProgramSummary } from '@/data/repositories/types';
import {
  buildAllEventProgress,
  buildPersonalRecords,
  type EventProgress,
  type PersonalRecord,
} from '@/domain/assessment/records';
import { ASSESSMENT_EVENTS, type AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import {
  baselineWithin,
  biggestDecline,
  biggestGain,
  categoryMovement,
  type CategoryMovement,
} from '@/domain/readiness/movement';
import type { ReadinessSnapshot, ReadinessTrend } from '@/domain/readiness/types';
import { volumeToDate, weeklyVolume, type WeeklyVolume } from '@/domain/training/volume';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface ProgressOverview {
  profile: AthleteProfile;
  results: readonly AssessmentResult[];
  records: readonly PersonalRecord[];
  progress: readonly EventProgress[];
  readiness: ReadinessSnapshot | null;
  trend: ReadinessTrend | null;
  /** Oldest first, ready to plot. */
  readinessHistory: readonly ReadinessSnapshot[];
  movements: readonly CategoryMovement[];
  gain: CategoryMovement | null;
  decline: CategoryMovement | null;
  volume: readonly WeeklyVolume[];
  program: ProgramSummary | null;
  position: ProgramPosition | null;
}

const READINESS_TREND_WINDOW_DAYS = 30;
/** Enough history for the charts without loading a full career. */
const HISTORY_PAGE_SIZE = 60;

const NO_PROFILE_ERROR = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

export function useProgressOverview(): AsyncResource<ProgressOverview> {
  const { athlete, assessment, readiness, training, workout } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<ProgressOverview>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE_ERROR);
    }

    const [
      resultsOutcome,
      latestOutcome,
      trendOutcome,
      historyOutcome,
      workoutsOutcome,
      programOutcome,
      positionOutcome,
    ] = await Promise.all([
      assessment.listResults(profile.id, { limit: HISTORY_PAGE_SIZE }),
      readiness.getLatest(profile.id),
      readiness.getTrend(profile.id, READINESS_TREND_WINDOW_DAYS),
      readiness.listHistory(profile.id, { limit: HISTORY_PAGE_SIZE }),
      workout.listResults(profile.id, { limit: HISTORY_PAGE_SIZE }),
      training.getProgram(profile.id),
      training.getPosition(profile.id),
    ]);

    if (!resultsOutcome.ok) return resultsOutcome;
    if (!latestOutcome.ok) return latestOutcome;
    if (!trendOutcome.ok) return trendOutcome;
    if (!historyOutcome.ok) return historyOutcome;
    if (!workoutsOutcome.ok) return workoutsOutcome;
    if (!programOutcome.ok) return programOutcome;
    if (!positionOutcome.ok) return positionOutcome;

    const results = resultsOutcome.value;
    // The repository returns newest first for lists; charts read left to right.
    const chronology = [...historyOutcome.value].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt),
    );

    const baseline = baselineWithin(
      chronology,
      READINESS_TREND_WINDOW_DAYS,
      new Date().toISOString(),
    );
    const movements = categoryMovement(latestOutcome.value, baseline);

    const program = programOutcome.value;
    const position = positionOutcome.value;
    const buckets = program
      ? weeklyVolume(
          workoutsOutcome.value,
          profile.createdAt,
          program.program.durationWeeks,
        )
      : [];

    return ok({
      profile,
      results,
      records: buildPersonalRecords(ASSESSMENT_EVENTS, results),
      progress: buildAllEventProgress(ASSESSMENT_EVENTS, results),
      readiness: latestOutcome.value,
      trend: trendOutcome.value,
      readinessHistory: chronology,
      movements,
      gain: biggestGain(movements),
      decline: biggestDecline(movements),
      // Future weeks would render as a run of empty bars implying missed
      // training the athlete has not reached yet.
      volume: position ? volumeToDate(buckets, position.weekNumber) : buckets,
      program,
      position,
    });
  }, [assessment, athlete, readiness, training, workout]);

  return useAsyncResource(fetcher);
}
