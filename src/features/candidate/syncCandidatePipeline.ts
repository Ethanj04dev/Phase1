import type { CandidateRepository } from '@/data/repositories/types';
import type { GoalId } from '@/domain/goals/types';
import { ok, type Result } from '@/domain/types';

/**
 * Keeps the candidate's pipeline in step with the training profile's goal.
 *
 * Changing pipeline moves the same account: no duplicate identity, no lost
 * history. Anything scored against a pipeline is recomputed downstream — the
 * readiness snapshot mechanism already refuses to compare across pipelines,
 * and the future rating recalculation hangs off this same field.
 *
 * A missing candidate profile is a no-op, not an error: athletes who
 * onboarded before identities existed can still change what they train for.
 */
export async function syncCandidatePipeline(
  candidate: CandidateRepository,
  pipelineId: GoalId,
): Promise<Result<void>> {
  const mine = await candidate.getMine();
  if (!mine.ok) {
    return mine;
  }
  if (!mine.value || mine.value.pipelineId === pipelineId) {
    return ok(undefined);
  }

  const updated = await candidate.update(mine.value.id, { pipelineId });
  return updated.ok ? ok(undefined) : updated;
}
