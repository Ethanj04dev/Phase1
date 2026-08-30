import type { IsoDateTime, Uuid } from '@/domain/types';

import type { MilestoneDefinition, TargetDefinition } from './types';

/**
 * The athlete's own preparation checklist.
 *
 * Personal admin, not official process guidance. Routes into a career field
 * differ, people do these steps out of order, and some skip steps entirely.
 * So nothing here gates anything, no step is presented as required, and the
 * order is a suggestion the athlete is free to ignore.
 *
 * Zero Phase records that the athlete says a step is done. It has no way to know
 * whether it is, and does not claim to.
 */

export interface MilestoneCompletion {
  id: Uuid;
  athleteId: Uuid;
  /** Matches a MilestoneDefinition id on the Target. */
  milestoneId: string;
  completedAt: IsoDateTime;
}

export interface MilestoneStanding {
  milestone: MilestoneDefinition;
  /** Null when not marked done. */
  completedAt: IsoDateTime | null;
}

/**
 * Every milestone the Target defines, in suggested order.
 *
 * Completed ones stay in place rather than moving to the bottom. This is a
 * route someone is walking, and reordering it as they go would make it harder
 * to see where they are, not easier.
 */
export function milestoneStandings(
  target: TargetDefinition,
  completions: readonly MilestoneCompletion[],
): readonly MilestoneStanding[] {
  const byId = new Map<string, MilestoneCompletion>();
  for (const completion of completions) {
    const held = byId.get(completion.milestoneId);
    // Newest wins, so a step marked done, undone and done again reads as the
    // most recent truth rather than the first thing ever recorded.
    if (!held || completion.completedAt > held.completedAt) {
      byId.set(completion.milestoneId, completion);
    }
  }

  return [...target.milestones]
    .sort((a, b) => a.order - b.order)
    .map((milestone) => ({
      milestone,
      completedAt: byId.get(milestone.id)?.completedAt ?? null,
    }));
}

export interface MilestoneProgress {
  completed: number;
  total: number;
}

export function milestoneProgress(
  standings: readonly MilestoneStanding[],
): MilestoneProgress {
  return {
    completed: standings.filter((standing) => standing.completedAt !== null).length,
    total: standings.length,
  };
}

/**
 * The lowest-ordered step not yet marked done.
 *
 * A suggestion, never a gate. An athlete who has a ship date but never told us
 * they sat the ASVAB still gets the ASVAB back as "suggested next", which is
 * correct: Zero Phase knows what they have told it, not what they have done.
 */
export function suggestedNextMilestone(
  standings: readonly MilestoneStanding[],
): MilestoneDefinition | null {
  return standings.find((standing) => standing.completedAt === null)?.milestone ?? null;
}
