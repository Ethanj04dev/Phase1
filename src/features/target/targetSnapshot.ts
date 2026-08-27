import { findTarget } from '@/data/content/targets';
import type { Repositories } from '@/data/repositories/types';
import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import {
  calculateTargetReadiness,
  type TargetReadiness,
} from '@/domain/readiness/targetScore';
import { currentLevels, type ProficiencyRating } from '@/domain/target/proficiency';
import { buildRoadToReady, type RoadToReady } from '@/domain/target/roadToReady';
import type { TargetDefinition } from '@/domain/target/types';
import { ok, type Result } from '@/domain/types';

/**
 * Everything derived from the athlete's Target, resolved once.
 *
 * Extracted because Today and the Target tab both need it. Two hooks each
 * doing their own version of this arithmetic is how a product ends up telling
 * an athlete to work on their swim on one screen and their ruck on another,
 * from identical data. There is one answer, computed in one place.
 */
export interface TargetSnapshot {
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
  /** The ordered work list, highest impact first. */
  road: RoadToReady | null;
}

export async function loadTargetSnapshot(
  repositories: Pick<Repositories, 'assessment' | 'proficiency' | 'training'>,
  profile: AthleteProfile,
): Promise<Result<TargetSnapshot>> {
  const { assessment, proficiency, training } = repositories;
  const target = findTarget(profile.goalId) ?? null;

  const [resultsOutcome, completionOutcome, ratingsOutcome] = await Promise.all([
    assessment.listResults(profile.id),
    training.getWeeklyCompletion(profile.id),
    proficiency.listRatings(profile.id),
  ]);

  // Assessment results are the backbone; without them there is no honest score
  // to show, so this one failure does propagate.
  if (!resultsOutcome.ok) {
    return resultsOutcome;
  }
  const results = resultsOutcome.value;

  // Ratings and training history each back a single domain. If either fails,
  // that domain reads as unmeasured -- which the model already handles -- and
  // the screen still renders.
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

  return ok({ target, results, ratings, readiness, road });
}
