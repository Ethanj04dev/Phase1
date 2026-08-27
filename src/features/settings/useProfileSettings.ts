import { useCallback, useState } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { AthleteProfile } from '@/domain/athlete/types';
import { recordReadinessSnapshot } from '@/features/readiness/recordSnapshot';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface ProfileSettingsState {
  saving: boolean;
  error: string | null;
  /** Set when a change caused readiness to be recalculated. */
  recalculatedTo: number | null;
}

type ProfilePatch = Partial<Omit<AthleteProfile, 'id' | 'userId' | 'createdAt'>>;

/** Loads the athlete profile for the settings screens. */
export function useAthleteProfile(): AsyncResource<AthleteProfile | null> {
  const { athlete } = useRepositories();
  const fetcher = useCallback(() => athlete.getCurrentProfile(), [athlete]);
  return useAsyncResource(fetcher);
}

/**
 * Applies profile edits.
 *
 * Changing the goal is not a cosmetic edit: each goal weights the four
 * categories differently, so the same performances produce a different
 * readiness score. The score is recalculated and a new snapshot recorded
 * rather than leaving the dashboard showing a number derived from weights the
 * athlete no longer trains under.
 *
 * That does put a step in the trend line, which is honest: the score changed
 * because what it measures changed, and hiding it would be worse than
 * explaining it.
 */
export function useUpdateProfile() {
  const { athlete, assessment, proficiency, readiness, training } = useRepositories();
  const [state, setState] = useState<ProfileSettingsState>({
    saving: false,
    error: null,
    recalculatedTo: null,
  });

  const update = useCallback(
    async (patch: ProfilePatch): Promise<AthleteProfile | null> => {
      setState({ saving: true, error: null, recalculatedTo: null });

      const currentResult = await athlete.getCurrentProfile();
      if (!currentResult.ok || !currentResult.value) {
        setState({
          saving: false,
          error: 'We could not find your athlete profile.',
          recalculatedTo: null,
        });
        return null;
      }
      const current = currentResult.value;

      const updated = await athlete.updateProfile(current.id, patch);
      if (!updated.ok) {
        setState({ saving: false, error: updated.error.message, recalculatedTo: null });
        return null;
      }

      const goalChanged = patch.goalId !== undefined && patch.goalId !== current.goalId;
      if (!goalChanged) {
        setState({ saving: false, error: null, recalculatedTo: null });
        return updated.value;
      }

      // Rescored against the new goal, which is also a new Target and so a
      // new set of weights. The updated profile is passed rather than the one
      // captured before the write.
      const recorded = await recordReadinessSnapshot(
        { assessment, proficiency, readiness, training },
        updated.value,
      );
      if (!recorded.ok) {
        // The profile edit succeeded; failing to rescore is not worth
        // reporting as a failed save, but it must not be silent either.
        setState({
          saving: false,
          error: 'Saved, but we could not update your readiness score.',
          recalculatedTo: null,
        });
        return updated.value;
      }

      setState({
        saving: false,
        error: null,
        recalculatedTo: recorded.value?.target?.overall ?? recorded.value?.overall ?? null,
      });
      return updated.value;
    },
    [assessment, athlete, proficiency, readiness, training],
  );

  return { update, ...state };
}
