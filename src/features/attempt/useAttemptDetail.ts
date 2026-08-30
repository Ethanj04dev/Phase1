import { useCallback } from 'react';

import { findAssessmentDefinition, scoringConfigFor } from '@/data/content/assessments';
import { useRepositories } from '@/data/repositoryContext';
import type { AssessmentDefinition } from '@/domain/attempt/definition';
import type { AssessmentAttempt } from '@/domain/attempt/types';
import { ratingBand } from '@/domain/scoring/config';
import { scoreAttempt, type EventScore } from '@/domain/scoring/score';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

/**
 * One attempt, rendered against the protocol version it was performed under.
 *
 * Per-event points are recomputed for display from the attempt's own scoring
 * config version where it is still shipped; the stored estimated rating is
 * never recomputed — the number the athlete saw is the number history keeps.
 */
export interface AttemptDetail {
  attempt: AssessmentAttempt;
  /** Null when the definition version is no longer shipped. */
  definition: AssessmentDefinition | null;
  /** Per-event points for performed events, empty when not scorable. */
  eventScores: readonly EventScore[];
  /** Band label for the estimated rating, when both exist. */
  bandLabel: string | null;
}

const NOT_FOUND = {
  code: 'not_found' as const,
  message: 'We could not find that assessment.',
};

export function useAttemptDetail(attemptId: string): AsyncResource<AttemptDetail> {
  const { athlete, attempt } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<AttemptDetail>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    if (!profileResult.value) {
      return err(NOT_FOUND);
    }

    const loaded = await attempt.get(profileResult.value.id, attemptId);
    if (!loaded.ok) {
      return loaded;
    }
    if (!loaded.value) {
      return err(NOT_FOUND);
    }
    const record = loaded.value;

    const definition =
      findAssessmentDefinition(record.definitionId, record.definitionVersion) ?? null;
    const config = scoringConfigFor(record.definitionId, record.definitionVersion);
    const score = config ? scoreAttempt(config, record.results) : null;
    const bandLabel =
      config && record.estimatedRating !== null
        ? (ratingBand(config, record.estimatedRating)?.label ?? null)
        : null;

    return ok({
      attempt: record,
      definition,
      eventScores: score?.eventScores ?? [],
      bandLabel,
    });
  }, [athlete, attempt, attemptId]);

  return useAsyncResource(fetcher);
}
