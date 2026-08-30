import type { PipelineDefinition, PipelineId } from '@/domain/pipeline/types';

import { PARARESCUE } from './pararescue';
import { RANGER } from './ranger';
import { SEAL } from './seal';

/**
 * The Target catalog.
 *
 * Adding a career should mean adding a definition file here and nothing else.
 * If a new Target needs application changes, the model is wrong and the model
 * is what should change.
 *
 * Pararescue proved the model; Ranger proved the promise, landing without a
 * single application change and exercising the no-water path end to end. The
 * remaining careers still run on the legacy goal catalog until each gets a
 * definition worth shipping: one genuinely right beats thirteen shallow.
 */
export const PIPELINES: readonly PipelineDefinition[] = [PARARESCUE, RANGER, SEAL];

const PIPELINES_BY_ID = new Map<PipelineId, PipelineDefinition>(
  PIPELINES.map((target) => [target.id, target]),
);

export function findPipeline(id: PipelineId): PipelineDefinition | undefined {
  return PIPELINES_BY_ID.get(id);
}

/** True when a career has a full Target definition rather than a legacy goal. */
export function hasPipelineDefinition(id: PipelineId): boolean {
  return PIPELINES_BY_ID.has(id);
}

export { PARARESCUE, RANGER, SEAL };
