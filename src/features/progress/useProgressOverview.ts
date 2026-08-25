import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import {
  buildAllEventProgress,
  buildPersonalRecords,
  type EventProgress,
  type PersonalRecord,
} from '@/domain/assessment/records';
import { ASSESSMENT_EVENTS, type AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { ReadinessSnapshot, ReadinessTrend } from '@/domain/readiness/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface ProgressOverview {
  profile: AthleteProfile;
  results: readonly AssessmentResult[];
  records: readonly PersonalRecord[];
  progress: readonly EventProgress[];
  readiness: ReadinessSnapshot | null;
  trend: ReadinessTrend | null;
  readinessHistory: readonly ReadinessSnapshot[];
}

const READINESS_TREND_WINDOW_DAYS = 30;
/** Enough history for the trend readouts without loading a full career. */
const HISTORY_PAGE_SIZE = 60;

const NO_PROFILE_ERROR = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

export function useProgressOverview(): AsyncResource<ProgressOverview> {
  const { athlete, assessment, readiness } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<ProgressOverview>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE_ERROR);
    }

    const [resultsOutcome, latestOutcome, trendOutcome, historyOutcome] = await Promise.all([
      assessment.listResults(profile.id, { limit: HISTORY_PAGE_SIZE }),
      readiness.getLatest(profile.id),
      readiness.getTrend(profile.id, READINESS_TREND_WINDOW_DAYS),
      readiness.listHistory(profile.id, { limit: HISTORY_PAGE_SIZE }),
    ]);

    if (!resultsOutcome.ok) return resultsOutcome;
    if (!latestOutcome.ok) return latestOutcome;
    if (!trendOutcome.ok) return trendOutcome;
    if (!historyOutcome.ok) return historyOutcome;

    const results = resultsOutcome.value;

    return ok({
      profile,
      results,
      records: buildPersonalRecords(ASSESSMENT_EVENTS, results),
      progress: buildAllEventProgress(ASSESSMENT_EVENTS, results),
      readiness: latestOutcome.value,
      trend: trendOutcome.value,
      readinessHistory: historyOutcome.value,
    });
  }, [assessment, athlete, readiness]);

  return useAsyncResource(fetcher);
}
