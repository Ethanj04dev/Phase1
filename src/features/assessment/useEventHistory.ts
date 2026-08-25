import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import { buildEventProgress, type EventProgress } from '@/domain/assessment/records';
import {
  findAssessmentEvent,
  type AssessmentEventId,
} from '@/domain/assessment/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

const UNKNOWN_EVENT = {
  code: 'not_found' as const,
  message: 'That assessment does not exist.',
};

const NO_PROFILE = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

/** Full history for a single event. */
export function useEventHistory(
  eventId: AssessmentEventId | undefined,
): AsyncResource<EventProgress> {
  const { athlete, assessment } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<EventProgress>> => {
    const event = eventId ? findAssessmentEvent(eventId) : undefined;
    if (!event) {
      return err(UNKNOWN_EVENT);
    }

    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    if (!profileResult.value) {
      return err(NO_PROFILE);
    }

    const results = await assessment.listResults(profileResult.value.id);
    if (!results.ok) {
      return results;
    }

    return ok(
      buildEventProgress(
        event,
        results.value.filter((result) => result.eventId === event.id),
      ),
    );
  }, [assessment, athlete, eventId]);

  return useAsyncResource(fetcher);
}
