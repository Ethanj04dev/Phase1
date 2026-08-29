import type { BlockPlan, DayPlan, SessionPlan } from './buildProgram';

/**
 * Session builders.
 *
 * Programmes are written as periodised templates rather than 168 hand-authored
 * days. That is how training blocks are actually written -- a repeating week
 * shape with progressive overload and a planned deload -- and it keeps the
 * content tunable instead of frozen in a wall of literals.
 *
 * All of this content is original to Phase 1. Nothing here is adapted from any
 * third-party paid programme or any organisation's published standards.
 */

// --- Block helpers -----------------------------------------------------------

export function warmUp(meters = 1200): BlockPlan {
  return {
    kind: 'steady',
    name: 'Warm-up',
    distanceMeters: meters,
    effort: { rpe: 3 },
    notes: 'Easy jog building to conversational pace, then leg swings and skips.',
  };
}

export function coolDown(meters = 1000): BlockPlan {
  return {
    kind: 'steady',
    name: 'Cool-down',
    distanceMeters: meters,
    effort: { rpe: 2 },
  };
}

export function easyRun(meters: number): BlockPlan {
  return {
    kind: 'steady',
    name: 'Easy aerobic run',
    distanceMeters: meters,
    effort: { rpe: 4 },
    notes: 'Nose-breathing pace. If you cannot hold a conversation, slow down.',
  };
}

export function tempoRun(meters: number): BlockPlan {
  return {
    kind: 'steady',
    name: 'Tempo',
    distanceMeters: meters,
    // Comfortably hard, a little slower than current 1.5 mile pace.
    target: { basis: 'one_and_half_mile_time', factor: 1.08, toleranceSeconds: 20 },
  };
}

export function runIntervals(
  reps: number,
  distanceMeters: number,
  recoverySeconds: number,
  factor: number,
): BlockPlan {
  return {
    kind: 'interval',
    name: `${reps} x ${distanceMeters}m`,
    reps,
    distanceMeters,
    recoverySeconds,
    target: { basis: 'mile_time', factor, toleranceSeconds: 5 },
  };
}

export function swimSet(
  reps: number,
  distanceMeters: number,
  restSeconds: number,
  rpe = 6,
): BlockPlan {
  return {
    kind: 'swim',
    name: `${reps} x ${distanceMeters}m`,
    reps,
    distanceMeters,
    restSeconds,
    effort: { rpe },
  };
}

export function swimIntervals(
  reps: number,
  distanceMeters: number,
  restSeconds: number,
  factor: number,
): BlockPlan {
  return {
    kind: 'swim',
    name: `${reps} x ${distanceMeters}m`,
    reps,
    distanceMeters,
    restSeconds,
    target: { basis: 'swim_500_time', factor, toleranceSeconds: 6 },
  };
}

export function ruckBlock(meters: number, pounds: number): BlockPlan {
  return {
    kind: 'ruck',
    name: 'Ruck',
    distanceMeters: meters,
    loadPounds: pounds,
    target: { basis: 'ruck_pace', factor: 1, toleranceSeconds: 60 },
  };
}

/**
 * A recovery-pace ruck. Meaningfully slower than the assessed pace and under
 * lighter load, because this block exists as a conservative substitute --
 * extra time under the straps, not extra strain.
 */
export function easyRuckBlock(meters: number, pounds: number): BlockPlan {
  return {
    kind: 'ruck',
    name: 'Easy ruck',
    distanceMeters: meters,
    loadPounds: pounds,
    // 12% slower than the athlete's assessed ruck pace, wide tolerance.
    target: { basis: 'ruck_pace', factor: 1.12, toleranceSeconds: 90 },
    notes: 'Conversational effort under the straps. This is aerobic time, not a pace piece.',
  };
}

export function calisthenicsBlock(
  name: string,
  sets: number,
  reps: number | 'max',
  restSeconds = 90,
): BlockPlan {
  return { kind: 'calisthenics', name, sets, reps, restSeconds };
}

export function strengthBlock(name: string, sets: number, reps: number, rpe = 7): BlockPlan {
  return { kind: 'strength', name, sets, reps, restSeconds: 120, effort: { rpe } };
}

export function mobility(minutes: number, description: string): BlockPlan {
  return {
    kind: 'recovery',
    name: 'Mobility',
    durationSeconds: minutes * 60,
    description,
  };
}

// --- Session helpers ---------------------------------------------------------

export function intervalRunSession(
  reps: number,
  distanceMeters: number,
  recoverySeconds: number,
  factor: number,
  minutes: number,
): SessionPlan {
  return {
    modality: 'running',
    title: 'Interval Run',
    estimatedMinutes: minutes,
    blocks: [warmUp(), runIntervals(reps, distanceMeters, recoverySeconds, factor), coolDown()],
  };
}

export function easyRunSession(meters: number, minutes: number): SessionPlan {
  return {
    modality: 'running',
    title: 'Easy Run',
    estimatedMinutes: minutes,
    blocks: [easyRun(meters)],
  };
}

export function tempoRunSession(meters: number, minutes: number): SessionPlan {
  return {
    modality: 'running',
    title: 'Tempo Run',
    estimatedMinutes: minutes,
    blocks: [warmUp(), tempoRun(meters), coolDown()],
  };
}

export function poolSession(
  title: string,
  blocks: readonly BlockPlan[],
  minutes: number,
): SessionPlan {
  return { modality: 'swimming', title, estimatedMinutes: minutes, blocks };
}

export function calisthenicsSession(
  blocks: readonly BlockPlan[],
  minutes: number,
): SessionPlan {
  return {
    modality: 'calisthenics',
    title: 'Calisthenics',
    estimatedMinutes: minutes,
    blocks,
  };
}

export function strengthSession(blocks: readonly BlockPlan[], minutes: number): SessionPlan {
  return { modality: 'strength', title: 'Strength', estimatedMinutes: minutes, blocks };
}

export function ruckSession(meters: number, pounds: number, minutes: number): SessionPlan {
  return {
    modality: 'rucking',
    title: 'Ruck',
    estimatedMinutes: minutes,
    blocks: [ruckBlock(meters, pounds)],
  };
}

export function easyRuckSession(meters: number, pounds: number, minutes: number): SessionPlan {
  return {
    modality: 'rucking',
    title: 'Easy Ruck',
    estimatedMinutes: minutes,
    blocks: [easyRuckBlock(meters, pounds)],
  };
}

export function recoverySession(minutes: number, description: string): SessionPlan {
  return {
    modality: 'recovery',
    title: 'Recovery',
    estimatedMinutes: minutes,
    blocks: [mobility(minutes, description)],
  };
}

// --- Day helpers -------------------------------------------------------------

export function restDay(): DayPlan {
  return {
    title: 'Rest',
    description: 'Full rest. Sleep is the session today.',
    restDay: true,
  };
}

export function recoveryDay(minutes = 30): DayPlan {
  return {
    title: 'Recovery',
    description: 'Easy movement and mobility. Nothing that leaves you tired.',
    sessions: [
      recoverySession(minutes, 'Easy walk or spin, then hips, ankles and thoracic spine.'),
    ],
  };
}

/** Standard upper-body pulling and pushing work used across all three tracks. */
export function standardCalisthenics(
  pullSets: number,
  pushReps: number,
  minutes: number,
): SessionPlan {
  return calisthenicsSession(
    [
      calisthenicsBlock('Pull-ups', pullSets, 'max', 120),
      calisthenicsBlock('Push-ups', 4, pushReps),
      calisthenicsBlock('Sit-ups', 3, 40, 60),
    ],
    minutes,
  );
}
