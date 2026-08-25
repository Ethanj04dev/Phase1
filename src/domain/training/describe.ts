import { formatDistance, formatDuration } from '@/lib/format';

import type { WorkoutBlock, WorkoutSession } from './types';

/**
 * Short, scannable description of a block for list rows and summaries.
 * Full prescriptions belong in the workout overview, not here.
 */
export function describeBlock(block: WorkoutBlock): string {
  switch (block.kind) {
    case 'interval':
      return `${block.reps} x ${formatDistance(block.distanceMeters)}`;
    case 'swim':
      return `${block.reps} x ${formatDistance(block.distanceMeters)}`;
    case 'steady':
      if (block.distanceMeters !== undefined) {
        return formatDistance(block.distanceMeters);
      }
      return block.durationSeconds === undefined
        ? block.name
        : formatDuration(block.durationSeconds);
    case 'ruck':
      return `${formatDistance(block.distanceMeters)} at ${block.loadPounds} lb`;
    case 'strength':
      return `${block.sets} x ${block.reps}`;
    case 'calisthenics':
      return `${block.sets} x ${block.reps === 'max' ? 'max' : block.reps}`;
    case 'recovery':
      return formatDuration(block.durationSeconds);
  }
}

/**
 * Headline work of a session. Picks the block that defines the session rather
 * than listing warm-ups, so the dashboard reads "6 x 800m" not "Warm-up".
 */
export function describeSession(session: WorkoutSession): string {
  const defining =
    session.blocks.find((block) => block.kind === 'interval' || block.kind === 'swim') ??
    session.blocks.find((block) => block.kind !== 'recovery') ??
    session.blocks[0];

  return defining ? describeBlock(defining) : '';
}

/** Total prescribed time for a day, used for the "about 1h 40m" line. */
export function totalEstimatedMinutes(sessions: readonly WorkoutSession[]): number {
  return sessions.reduce((total, session) => total + session.estimatedMinutes, 0);
}
