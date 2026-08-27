import { useCallback, useState } from 'react';

import { findTarget } from '@/data/content/targets';
import { useRepositories } from '@/data/repositoryContext';
import {
  milestoneProgress,
  milestoneStandings,
  suggestedNextMilestone,
  type MilestoneProgress,
  type MilestoneStanding,
} from '@/domain/target/milestones';
import type { MilestoneDefinition, TargetDefinition } from '@/domain/target/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface MilestonesView {
  target: TargetDefinition | null;
  standings: readonly MilestoneStanding[];
  progress: MilestoneProgress;
  /** A suggestion, never a gate. */
  suggestedNext: MilestoneDefinition | null;
}

export interface UseMilestones extends AsyncResource<MilestonesView> {
  /** Toggles one step. Optimistic, with the row reverted if the write fails. */
  toggle: (milestoneId: string, completed: boolean) => Promise<void>;
  /** Ids currently being written, so the row can show it is in flight. */
  pending: ReadonlySet<string>;
  error: string | null;
}

const NO_PROFILE = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

export function useMilestones(): UseMilestones {
  const { athlete, milestone } = useRepositories();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(async (): Promise<Result<MilestonesView>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE);
    }

    const target = findTarget(profile.goalId) ?? null;
    if (!target) {
      return ok({
        target: null,
        standings: [],
        progress: { completed: 0, total: 0 },
        suggestedNext: null,
      });
    }

    const completions = await milestone.listCompletions(profile.id);
    if (!completions.ok) {
      return completions;
    }

    const standings = milestoneStandings(target, completions.value);
    return {
      ok: true,
      value: {
        target,
        standings,
        progress: milestoneProgress(standings),
        suggestedNext: suggestedNextMilestone(standings),
      },
    };
  }, [athlete, milestone]);

  const resource = useAsyncResource(fetcher);
  const { reload } = resource;

  const toggle = useCallback(
    async (milestoneId: string, completed: boolean) => {
      const profileResult = await athlete.getCurrentProfile();
      if (!profileResult.ok || !profileResult.value) {
        setError('We could not find your athlete profile.');
        return;
      }

      setError(null);
      setPending((current) => new Set(current).add(milestoneId));

      const outcome = await milestone.setCompleted(
        profileResult.value.id,
        milestoneId,
        completed,
      );

      setPending((current) => {
        const next = new Set(current);
        next.delete(milestoneId);
        return next;
      });

      if (!outcome.ok) {
        // The repository already produced a human-readable message; nothing
        // raw from the backend reaches this string.
        setError(outcome.error.message);
        return;
      }
      reload();
    },
    [athlete, milestone, reload],
  );

  return { ...resource, toggle, pending, error };
}
