import { useCallback, useState } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { NewAssessmentResult } from '@/data/repositories/types';
import type { AssessmentResult } from '@/domain/assessment/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { calculateReadiness } from '@/domain/readiness/score';

export interface LogAssessmentOutcome {
  recorded: readonly AssessmentResult[];
  /** Overall readiness after the new results, or null if nothing is scoreable. */
  readinessAfter: number | null;
  /** Overall readiness before, so the screen can show the movement. */
  readinessBefore: number | null;
}

interface LogAssessmentState {
  submitting: boolean;
  error: string | null;
}

/**
 * Records a batch of results and rolls readiness forward.
 *
 * Readiness is recalculated from the athlete's *full* history rather than the
 * batch alone, because scoring uses the latest result per event: retesting
 * only your swim must not discard what your running says about you.
 *
 * The new snapshot is appended rather than replacing the previous one. That
 * append-only history is what makes the trend line real instead of a
 * before-and-after guess.
 */
export function useLogAssessment() {
  const { athlete, assessment, readiness } = useRepositories();
  const [state, setState] = useState<LogAssessmentState>({
    submitting: false,
    error: null,
  });

  const log = useCallback(
    async (entries: readonly NewAssessmentResult[]): Promise<LogAssessmentOutcome | null> => {
      if (entries.length === 0) {
        return null;
      }

      setState({ submitting: true, error: null });

      try {
        const profileResult = await athlete.getCurrentProfile();
        if (!profileResult.ok) {
          setState({ submitting: false, error: profileResult.error.message });
          return null;
        }
        const profile = profileResult.value;
        if (!profile) {
          setState({
            submitting: false,
            error: 'We could not find your athlete profile.',
          });
          return null;
        }

        const goal = getGoalOrDefault(profile.goalId);

        const previousSnapshot = await readiness.getLatest(profile.id);
        const readinessBefore = previousSnapshot.ok
          ? (previousSnapshot.value?.overall ?? null)
          : null;

        const recorded = await assessment.recordResults(profile.id, entries);
        if (!recorded.ok) {
          setState({ submitting: false, error: recorded.error.message });
          return null;
        }

        const allResults = await assessment.listResults(profile.id);
        if (!allResults.ok) {
          setState({ submitting: false, error: allResults.error.message });
          return null;
        }

        const calculation = calculateReadiness(goal, allResults.value);
        if (calculation) {
          const snapshot = await readiness.record(profile.id, calculation);
          if (!snapshot.ok) {
            setState({ submitting: false, error: snapshot.error.message });
            return null;
          }
        }

        setState({ submitting: false, error: null });
        return {
          recorded: recorded.value,
          readinessAfter: calculation?.overall ?? null,
          readinessBefore,
        };
      } catch {
        setState({
          submitting: false,
          error: 'Something went wrong saving your results. Please try again.',
        });
        return null;
      }
    },
    [assessment, athlete, readiness],
  );

  return { log, submitting: state.submitting, error: state.error };
}
