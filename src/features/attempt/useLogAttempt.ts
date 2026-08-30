import { useCallback, useState } from 'react';

import { scoringConfigFor } from '@/data/content/assessments';
import { useRepositories } from '@/data/repositoryContext';
import type { AssessmentEventId } from '@/domain/assessment/types';
import type { AssessmentDefinition } from '@/domain/attempt/definition';
import {
  isAttemptComplete,
  type AssessmentAttempt,
  type AttemptEventResult,
} from '@/domain/attempt/types';
import { scoreAttempt } from '@/domain/scoring/score';
import type { IsoDateTime } from '@/domain/types';

export type AttemptEntries = Partial<Record<AssessmentEventId, number>>;

/**
 * Builds the ordered event results a draft produces. Order comes from the
 * definition's sequence, not entry order — the attempt records the protocol
 * as performed.
 */
export function buildAttemptResults(
  definition: AssessmentDefinition,
  entries: AttemptEntries,
): AttemptEventResult[] {
  const results: AttemptEventResult[] = [];
  definition.events.forEach((event, index) => {
    const value = entries[event.eventId];
    if (value !== undefined) {
      results.push({ eventId: event.eventId, value, order: index });
    }
  });
  return results;
}

/**
 * Saves a self-reported assessment attempt.
 *
 * The estimate is computed here, once, from the versioned scoring config —
 * and only for complete attempts. An incomplete attempt is saved as history
 * with no rating: a number for a performance that did not fully happen is
 * the exact thing the product refuses to print. What this hook cannot do,
 * by construction, is mark anything verified: the repository seam has no
 * field for it.
 */
export function useLogAttempt() {
  const { athlete, attempt } = useRepositories();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (
      definition: AssessmentDefinition,
      entries: AttemptEntries,
      occurredAt: IsoDateTime,
      notes: string | null,
    ): Promise<AssessmentAttempt | null> => {
      setSaving(true);
      setError(null);
      try {
        const profileResult = await athlete.getCurrentProfile();
        if (!profileResult.ok || !profileResult.value) {
          setError('We could not find your athlete profile.');
          return null;
        }

        const results = buildAttemptResults(definition, entries);
        if (results.length === 0) {
          setError('Enter at least one result.');
          return null;
        }

        const complete = isAttemptComplete(definition, results);
        const config = scoringConfigFor(definition.id, definition.version);
        const score = complete && config ? scoreAttempt(config, results) : null;

        const recorded = await attempt.record(profileResult.value.id, {
          definitionId: definition.id,
          definitionVersion: definition.version,
          pipelineId: definition.pipelineId,
          status: complete ? 'completed' : 'incomplete',
          occurredAt,
          startedAt: null,
          completedAt: complete ? occurredAt : null,
          results,
          estimatedRating: score?.rating ?? null,
          scoringConfigVersion: score?.configVersion ?? null,
          notes,
        });

        if (!recorded.ok) {
          setError(recorded.error.message);
          return null;
        }
        return recorded.value;
      } finally {
        setSaving(false);
      }
    },
    [athlete, attempt],
  );

  return { save, saving, error };
}
