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

/** Prescribed distance for a block, or 0 when it is not distance-based. */
function blockDistance(block: WorkoutBlock): number {
  switch (block.kind) {
    case 'interval':
    case 'swim':
      return block.distanceMeters * block.reps;
    case 'steady':
      return block.distanceMeters ?? 0;
    case 'ruck':
      return block.distanceMeters;
    default:
      return 0;
  }
}

/**
 * Headline work of a session. Picks the block that defines the session rather
 * than listing warm-ups, so the dashboard reads "6 x 800m" not "Warm-up".
 *
 * A carried pace target is the strongest signal: warm-ups and cool-downs are
 * prescribed by effort, while the work that defines the session is the piece
 * with a time to hit. Falling back to the longest block catches sessions that
 * are all effort-based, such as an easy swim.
 */
export function describeSession(session: WorkoutSession): string {
  const targeted = session.blocks.find((block) => 'target' in block && block.target);
  if (targeted) {
    return describeBlock(targeted);
  }

  const working = session.blocks.filter((block) => block.kind !== 'recovery');
  const longest = working.reduce<WorkoutBlock | null>(
    (best, block) =>
      best === null || blockDistance(block) > blockDistance(best) ? block : best,
    null,
  );

  const defining = longest ?? session.blocks[0];
  return defining ? describeBlock(defining) : '';
}

/** Total prescribed time for a day, used for the "about 1h 40m" line. */
export function totalEstimatedMinutes(sessions: readonly WorkoutSession[]): number {
  return sessions.reduce((total, session) => total + session.estimatedMinutes, 0);
}
