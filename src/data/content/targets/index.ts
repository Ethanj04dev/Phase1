import type { TargetDefinition, TargetId } from '@/domain/target/types';

import { PARARESCUE } from './pararescue';
import { RANGER } from './ranger';

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
export const TARGETS: readonly TargetDefinition[] = [PARARESCUE, RANGER];

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

export { PARARESCUE, RANGER };
