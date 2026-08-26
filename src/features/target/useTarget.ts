import { useCallback } from 'react';

import { findTarget } from '@/data/content/targets';
import { useRepositories } from '@/data/repositoryContext';
import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import {
  calculateTargetReadiness,
  type TargetReadiness,
} from '@/domain/readiness/targetScore';
import { currentLevels, type ProficiencyRating } from '@/domain/target/proficiency';
import { buildRoadToReady, type RoadToReady } from '@/domain/target/roadToReady';
import type { TargetDefinition } from '@/domain/target/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface TargetView {
  profile: AthleteProfile;
  /**
   * Null when the athlete's career has no full Target definition yet. Only
   * Pararescue is modelled; the rest still run on the legacy goal catalog, and
   * the UI says so rather than pretending otherwise.
   */
  target: TargetDefinition | null;
  results: readonly AssessmentResult[];
  /** Self-assessed skill history, for domains measured by proficiency. */
  ratings: readonly ProficiencyRating[];
  /** Scored against the Target's own domains. Null when nothing is measured. */
  readiness: TargetReadiness | null;
  /**
   * The ordered work list. Derived here rather than per screen so Today, the
   * Target overview and Road to Ready cannot end up recommending different
   * things from the same data.
   */
  road: RoadToReady | null;
}

const NO_PROFILE = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

export function useTarget(): AsyncResource<TargetView> {
  const { athlete, assessment, proficiency, training, workout } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<TargetView>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE);
    }

    const target = findTarget(profile.goalId) ?? null;

    const [resultsOutcome, completionOutcome, ratingsOutcome] = await Promise.all([
      assessment.listResults(profile.id),
      training.getWeeklyCompletion(profile.id),
      proficiency.listRatings(profile.id),
    ]);
    if (!resultsOutcome.ok) {
      return resultsOutcome;
    }
    // Workout history is only needed for behavioural domains; a failure there
    // should cost the athlete their consistency score, not the whole screen.
    void workout;

    const results = resultsOutcome.value;
    // Ratings are supporting data for one domain. If they fail to load, that
    // domain reads as unmeasured -- which the whole model already handles --
    // rather than taking the screen down with it.
    const ratings = ratingsOutcome.ok ? ratingsOutcome.value : [];

    const readiness = target
      ? calculateTargetReadiness(target, {
          results,
          proficiency: currentLevels(ratings),
          behavioural: completionOutcome.ok
            ? { training_consistency: Math.round(completionOutcome.value * 100) }
            : {},
        })
      : null;

    const road = target ? buildRoadToReady(target, readiness, results) : null;

    return ok({ profile, target, results, ratings, readiness, road });
  }, [assessment, athlete, proficiency, training, workout]);

  return useAsyncResource(fetcher);
}
