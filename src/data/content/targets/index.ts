import type { TargetDefinition, TargetId } from '@/domain/target/types';

import { PARARESCUE } from './pararescue';

/**
 * The Target catalog.
 *
 * Adding a career should mean adding a definition file here and nothing else.
 * If a new Target needs application changes, the model is wrong and the model
 * is what should change.
 *
 * Only Pararescue is modelled so far. The remaining careers still run on the
 * legacy goal catalog until the architecture is proven on this one, which is
 * deliberate: getting one Target genuinely right is worth more than thirteen
 * shallow ones.
 */
export const TARGETS: readonly TargetDefinition[] = [PARARESCUE];

const TARGETS_BY_ID = new Map<TargetId, TargetDefinition>(
  TARGETS.map((target) => [target.id, target]),
);

export function findTarget(id: TargetId): TargetDefinition | undefined {
  return TARGETS_BY_ID.get(id);
}

/** True when a career has a full Target definition rather than a legacy goal. */
export function hasTargetDefinition(id: TargetId): boolean {
  return TARGETS_BY_ID.has(id);
}

export { PARARESCUE };
