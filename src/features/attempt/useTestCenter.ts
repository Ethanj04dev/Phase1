import { useCallback } from 'react';

import { assessmentForPipeline } from '@/data/content/assessments';
import { useRepositories } from '@/data/repositoryContext';
import { latestResultByEvent } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { AssessmentDefinition } from '@/domain/attempt/definition';
import type { AssessmentAttempt } from '@/domain/attempt/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

/**
 * Everything the Test tab needs, in one load.
 *
 * The definition is a content lookup off the athlete's pipeline — pipelines
 * without one get `null` and the tab says so honestly rather than borrowing
 * another pipeline's protocol.
 */
export interface TestCenter {
  profile: AthleteProfile;
  /** The current assessment protocol for the athlete's pipeline, if defined. */
  definition: AssessmentDefinition | null;
  /** Newest first. */
  attempts: readonly AssessmentAttempt[];
  latestAttempt: AssessmentAttempt | null;
  /** How many individual events have at least one training result. */
  testedEvents: number;
}

const ATTEMPT_PAGE_SIZE = 60;

const NO_PROFILE_ERROR = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

export function useTestCenter(): AsyncResource<TestCenter> {
  const { athlete, assessment, attempt } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<TestCenter>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE_ERROR);
    }

    const [attemptsOutcome, resultsOutcome] = await Promise.all([
      attempt.list(profile.id, { limit: ATTEMPT_PAGE_SIZE }),
      assessment.listResults(profile.id, { limit: ATTEMPT_PAGE_SIZE }),
    ]);
    if (!attemptsOutcome.ok) return attemptsOutcome;
    if (!resultsOutcome.ok) return resultsOutcome;

    return ok({
      profile,
      definition: assessmentForPipeline(profile.goalId) ?? null,
      attempts: attemptsOutcome.value,
      latestAttempt: attemptsOutcome.value[0] ?? null,
      testedEvents: latestResultByEvent(resultsOutcome.value).size,
    });
  }, [assessment, athlete, attempt]);

  return useAsyncResource(fetcher);
}
