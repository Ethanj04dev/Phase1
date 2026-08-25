import type { ResolvedTarget } from './targets';
import type {
  ActiveEntry,
  ActiveSession,
  TimerSegment,
  WorkoutBlock,
  WorkoutSession,
} from './types';

/**
 * Active-session logic: the clock, rep verdicts and the completion summary.
 *
 * Every function is pure and takes `now` as an argument. Nothing here reads a
 * clock, which is what makes the timer testable and, more importantly, what
 * makes it correct across app suspension.
 */

// --- Timer -------------------------------------------------------------------

export function isTimerRunning(segments: readonly TimerSegment[]): boolean {
  const last = segments[segments.length - 1];
  return last !== undefined && last.endedAt === null;
}

/**
 * Total elapsed time across every segment.
 *
 * Derived from timestamps, never accumulated by ticking. A session
 * backgrounded for twenty minutes returns twenty minutes more when it wakes,
 * because the arithmetic is done against the wall clock rather than against
 * however many render frames happened to fire.
 */
export function elapsedSeconds(segments: readonly TimerSegment[], now: string): number {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    return 0;
  }

  let total = 0;
  for (const segment of segments) {
    const start = Date.parse(segment.startedAt);
    if (Number.isNaN(start)) {
      continue;
    }
    const end = segment.endedAt === null ? nowMs : Date.parse(segment.endedAt);
    if (Number.isNaN(end)) {
      continue;
    }
    // A backwards segment means a clock change, not negative training time.
    total += Math.max(0, end - start);
  }

  return Math.floor(total / 1000);
}

export function startTimer(segments: readonly TimerSegment[], now: string): TimerSegment[] {
  if (isTimerRunning(segments)) {
    return [...segments];
  }
  return [...segments, { startedAt: now, endedAt: null }];
}

export function pauseTimer(segments: readonly TimerSegment[], now: string): TimerSegment[] {
  if (!isTimerRunning(segments)) {
    return [...segments];
  }
  return segments.map((segment, index) =>
    index === segments.length - 1 ? { ...segment, endedAt: now } : segment,
  );
}

// --- Rep verdicts ------------------------------------------------------------

export type RepVerdict = 'faster' | 'on_target' | 'slower' | 'unknown';

/**
 * How a logged repetition compares to its target window.
 *
 * `faster` is not automatically praise: on an aerobic interval, running well
 * under the window usually means the athlete is burning a session they were
 * meant to control. The UI phrases it neutrally.
 */
export function verdictFor(target: ResolvedTarget | null, durationSeconds: number): RepVerdict {
  if (!target || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 'unknown';
  }
  if (durationSeconds < target.lowSeconds) {
    return 'faster';
  }
  if (durationSeconds > target.highSeconds) {
    return 'slower';
  }
  return 'on_target';
}

// --- Progress ----------------------------------------------------------------

/** How many repetitions a block expects. */
export function expectedReps(block: WorkoutBlock): number {
  switch (block.kind) {
    case 'interval':
    case 'swim':
      return block.reps;
    case 'strength':
    case 'calisthenics':
      return block.sets;
    default:
      return 1;
  }
}

export function entriesForBlock(
  session: ActiveSession,
  blockId: string,
): readonly ActiveEntry[] {
  return session.entries
    .filter((entry) => entry.blockId === blockId)
    .sort((a, b) => a.repIndex - b.repIndex);
}

/**
 * Replaces an entry at the same block and rep index, or appends a new one.
 * Editing a mis-tapped rep must correct it rather than duplicate it.
 */
export function upsertEntry(
  entries: readonly ActiveEntry[],
  entry: ActiveEntry,
): ActiveEntry[] {
  const index = entries.findIndex(
    (existing) => existing.blockId === entry.blockId && existing.repIndex === entry.repIndex,
  );
  if (index === -1) {
    return [...entries, entry];
  }
  return entries.map((existing, position) => (position === index ? entry : existing));
}

export function removeEntry(
  entries: readonly ActiveEntry[],
  blockId: string,
  repIndex: number,
): ActiveEntry[] {
  return entries.filter((entry) => !(entry.blockId === blockId && entry.repIndex === repIndex));
}

// --- Summary -----------------------------------------------------------------

export interface SessionSummary {
  durationSeconds: number;
  /** Total metres covered across every logged entry. */
  distanceMeters: number;
  /** Repetitions logged, across every block. */
  loggedEntries: number;
  /** Repetitions the day prescribed. */
  prescribedEntries: number;
  /** Logged reps that fell inside their target window. */
  onTarget: number;
  /** Logged reps that had a target to be judged against. */
  targeted: number;
}

/**
 * Rolls an active session into the numbers shown on the completion screen.
 *
 * `resolveTarget` is injected rather than imported so this stays pure and the
 * caller owns how targets are derived.
 */
export function summariseSession(
  session: ActiveSession,
  sessions: readonly WorkoutSession[],
  now: string,
  resolveTarget: (block: WorkoutBlock) => ResolvedTarget | null,
): SessionSummary {
  const blocks = sessions.flatMap((workoutSession) => workoutSession.blocks);
  const blockById = new Map(blocks.map((block) => [block.id, block]));

  let distanceMeters = 0;
  let onTarget = 0;
  let targeted = 0;

  for (const entry of session.entries) {
    if (entry.distanceMeters !== undefined) {
      distanceMeters += entry.distanceMeters;
    }

    const block = blockById.get(entry.blockId);
    if (!block || entry.durationSeconds === undefined) {
      continue;
    }
    const target = resolveTarget(block);
    if (!target) {
      continue;
    }
    targeted += 1;
    if (verdictFor(target, entry.durationSeconds) === 'on_target') {
      onTarget += 1;
    }
  }

  return {
    durationSeconds: elapsedSeconds(session.segments, now),
    distanceMeters,
    loggedEntries: session.entries.length,
    prescribedEntries: blocks.reduce((total, block) => total + expectedReps(block), 0),
    onTarget,
    targeted,
  };
}
