import type { Repositories } from '@/data/repositories/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { calculateReadiness } from '@/domain/readiness/score';
import type { ReadinessCalculation, ReadinessSnapshot } from '@/domain/readiness/types';
import { ok, type Result } from '@/domain/types';
import { loadTargetSnapshot } from '@/features/target/targetSnapshot';

/**
 * Records one readiness snapshot, on both scales.
 *
 * Three screens used to do this independently -- onboarding, logging an
 * assessment, and changing goal -- each computing only the legacy category
 * score. Any Target-aware history would have depended on all three being
 * updated together, which is exactly the kind of thing that gets missed.
 *
 * The two scales are stored side by side rather than one replacing the other.
 * They are not comparable: the same athlete scores differently under four
 * goal-weighted categories than under eight target-weighted domains. Keeping
 * both means old history stays readable and new history is honest, without
 * anyone having to pretend the numbers mean the same thing.
 */

type RequiredRepositories = Pick<
  Repositories,
  'assessment' | 'proficiency' | 'readiness' | 'training'
>;

/**
 * Builds the calculation without writing it.
 *
 * Returns null when there is nothing to score -- an athlete who has recorded
 * no results at all. Null is not a failure; it is the honest state of someone
 * who has not tested anything yet.
 */
export async function buildReadinessCalculation(
  repositories: RequiredRepositories,
  profile: AthleteProfile,
): Promise<Result<ReadinessCalculation | null>> {
  const { assessment, proficiency, training } = repositories;

  const resultsOutcome = await assessment.listResults(profile.id);
  if (!resultsOutcome.ok) {
    return resultsOutcome;
  }

  const legacy = calculateReadiness(getGoalOrDefault(profile.goalId), resultsOutcome.value);
  const snapshot = await loadTargetSnapshot({ assessment, proficiency, training }, profile);

  // A Target failure costs the Target half of the record, not the record.
  const targetReadiness = snapshot.ok ? snapshot.value.readiness : null;
  const targetId = snapshot.ok ? (snapshot.value.target?.id ?? null) : null;

  const target =
    targetReadiness && targetId
      ? {
          targetId,
          overall: targetReadiness.overall,
          domains: targetReadiness.domains,
          strongestDomain: targetReadiness.strongestDomain,
          priorityDomain: targetReadiness.priorityDomain,
          coverage: targetReadiness.coverage,
        }
      : null;

  if (!legacy) {
    // No legacy score is possible without results, and without results there
    // is no Target score either. Nothing to record.
    return ok(null);
  }

  return ok({ ...legacy, target });
}

/**
 * Builds and stores a snapshot.
 *
 * Returns null when there was nothing to score, so a caller can tell "no
 * results yet" apart from "the write failed".
 */
export async function recordReadinessSnapshot(
  repositories: RequiredRepositories,
  profile: AthleteProfile,
): Promise<Result<ReadinessSnapshot | null>> {
  const calculation = await buildReadinessCalculation(repositories, profile);
  if (!calculation.ok) {
    return calculation;
  }
  if (!calculation.value) {
    return ok(null);
  }

  const recorded = await repositories.readiness.record(profile.id, calculation.value);
  return recorded.ok ? ok(recorded.value) : recorded;
}
