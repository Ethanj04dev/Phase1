import {
  elapsedSeconds,
  entriesForBlock,
  expectedReps,
  isTimerRunning,
  pauseTimer,
  removeEntry,
  startTimer,
  summariseSession,
  upsertEntry,
  verdictFor,
} from './session';
import type { ResolvedTarget } from './targets';
import type {
  ActiveEntry,
  ActiveSession,
  TimerSegment,
  WorkoutBlock,
  WorkoutSession,
} from './types';

const T = (minutes: number, seconds = 0): string =>
  new Date(Date.UTC(2026, 7, 25, 10, minutes, seconds)).toISOString();

function entry(
  blockId: string,
  repIndex: number,
  overrides: Partial<ActiveEntry> = {},
): ActiveEntry {
  return { blockId, repIndex, recordedAt: T(0), ...overrides };
}

describe('timer', () => {
  it('starts stopped with no segments', () => {
    expect(isTimerRunning([])).toBe(false);
    expect(elapsedSeconds([], T(10))).toBe(0);
  });

  it('counts an open segment against the current time', () => {
    const segments = startTimer([], T(0));
    expect(isTimerRunning(segments)).toBe(true);
    expect(elapsedSeconds(segments, T(5))).toBe(300);
  });

  // The requirement that justifies timestamps over a ticking counter: no
  // render frames fire while the app is suspended, but time still passes.
  it('accrues time while the app was suspended', () => {
    const segments = startTimer([], T(0));
    expect(elapsedSeconds(segments, T(41, 30))).toBe(2490);
  });

  it('stops accruing once paused', () => {
    const running = startTimer([], T(0));
    const paused = pauseTimer(running, T(10));
    expect(isTimerRunning(paused)).toBe(false);
    expect(elapsedSeconds(paused, T(30))).toBe(600);
  });

  it('sums across pause and resume', () => {
    let segments: TimerSegment[] = startTimer([], T(0));
    segments = pauseTimer(segments, T(10));
    segments = startTimer(segments, T(25));
    expect(elapsedSeconds(segments, T(30))).toBe(900); // 10 min + 5 min
  });

  it('ignores a redundant start or pause', () => {
    const running = startTimer(startTimer([], T(0)), T(5));
    expect(running).toHaveLength(1);
    const paused = pauseTimer(pauseTimer(running, T(10)), T(20));
    expect(elapsedSeconds(paused, T(60))).toBe(600);
  });

  it('never returns negative time when the clock moves backwards', () => {
    const segments: TimerSegment[] = [{ startedAt: T(30), endedAt: null }];
    expect(elapsedSeconds(segments, T(10))).toBe(0);
  });

  it('survives an unparseable timestamp without corrupting the total', () => {
    const segments: TimerSegment[] = [
      { startedAt: T(0), endedAt: T(5) },
      { startedAt: 'nonsense', endedAt: null },
    ];
    expect(elapsedSeconds(segments, T(10))).toBe(300);
  });
});

describe('verdictFor', () => {
  const target: ResolvedTarget = {
    lowSeconds: 182,
    highSeconds: 192,
    targetSeconds: 187,
    basis: 'mile_time',
    estimated: false,
  };

  it('reports a rep inside the window as on target', () => {
    expect(verdictFor(target, 187)).toBe('on_target');
    expect(verdictFor(target, 182)).toBe('on_target');
    expect(verdictFor(target, 192)).toBe('on_target');
  });

  it('reports reps outside the window', () => {
    expect(verdictFor(target, 175)).toBe('faster');
    expect(verdictFor(target, 200)).toBe('slower');
  });

  it('is unknown without a target or a usable time', () => {
    expect(verdictFor(null, 187)).toBe('unknown');
    expect(verdictFor(target, 0)).toBe('unknown');
    expect(verdictFor(target, Number.NaN)).toBe('unknown');
  });
});

describe('entries', () => {
  it('corrects a mis-tapped rep instead of duplicating it', () => {
    let entries = upsertEntry([], entry('b1', 1, { durationSeconds: 300 }));
    entries = upsertEntry(entries, entry('b1', 1, { durationSeconds: 187 }));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.durationSeconds).toBe(187);
  });

  it('appends distinct reps', () => {
    let entries = upsertEntry([], entry('b1', 1));
    entries = upsertEntry(entries, entry('b1', 2));
    entries = upsertEntry(entries, entry('b2', 1));
    expect(entries).toHaveLength(3);
  });

  it('removes a single rep', () => {
    const entries = [entry('b1', 1), entry('b1', 2)];
    expect(removeEntry(entries, 'b1', 1)).toHaveLength(1);
    expect(removeEntry(entries, 'b1', 9)).toHaveLength(2);
  });

  it('returns one block’s entries in rep order', () => {
    const session: ActiveSession = {
      id: 'a',
      athleteId: 'ath',
      workoutDayId: 'd1',
      startedAt: T(0),
      segments: [],
      rpe: null,
      notes: '',
      entries: [entry('b1', 3), entry('b2', 1), entry('b1', 1), entry('b1', 2)],
    };
    expect(entriesForBlock(session, 'b1').map((e) => e.repIndex)).toEqual([1, 2, 3]);
  });
});

describe('expectedReps', () => {
  it('reads reps, sets or a single effort depending on the block', () => {
    const interval: WorkoutBlock = {
      id: 'b1',
      order: 1,
      kind: 'interval',
      name: 'x',
      reps: 6,
      distanceMeters: 800,
      recoverySeconds: 120,
      target: { basis: 'mile_time', factor: 0.94, toleranceSeconds: 5 },
    };
    const strength: WorkoutBlock = {
      id: 'b2',
      order: 2,
      kind: 'strength',
      name: 'x',
      sets: 4,
      reps: 8,
      restSeconds: 120,
    };
    const steady: WorkoutBlock = {
      id: 'b3',
      order: 3,
      kind: 'steady',
      name: 'x',
      distanceMeters: 5000,
    };
    expect(expectedReps(interval)).toBe(6);
    expect(expectedReps(strength)).toBe(4);
    expect(expectedReps(steady)).toBe(1);
  });
});

describe('summariseSession', () => {
  const intervals: WorkoutBlock = {
    id: 'b1',
    order: 1,
    kind: 'interval',
    name: '800s',
    reps: 4,
    distanceMeters: 800,
    recoverySeconds: 120,
    target: { basis: 'mile_time', factor: 0.94, toleranceSeconds: 5 },
  };
  const sessions: WorkoutSession[] = [
    {
      id: 's1',
      workoutDayId: 'd1',
      order: 1,
      modality: 'running',
      title: 'Interval Run',
      estimatedMinutes: 45,
      blocks: [intervals],
    },
  ];
  const target: ResolvedTarget = {
    lowSeconds: 182,
    highSeconds: 192,
    targetSeconds: 187,
    basis: 'mile_time',
    estimated: false,
  };

  const active: ActiveSession = {
    id: 'a1',
    athleteId: 'ath',
    workoutDayId: 'd1',
    startedAt: T(0),
    segments: [{ startedAt: T(0), endedAt: T(45) }],
    entries: [
      entry('b1', 1, { durationSeconds: 187, distanceMeters: 800 }),
      entry('b1', 2, { durationSeconds: 190, distanceMeters: 800 }),
      entry('b1', 3, { durationSeconds: 205, distanceMeters: 800 }),
    ],
    rpe: 8,
    notes: '',
  };

  it('totals duration, distance and target performance', () => {
    const summary = summariseSession(active, sessions, T(60), () => target);
    expect(summary.durationSeconds).toBe(2700);
    expect(summary.distanceMeters).toBe(2400);
    expect(summary.loggedEntries).toBe(3);
    expect(summary.prescribedEntries).toBe(4);
    expect(summary.targeted).toBe(3);
    expect(summary.onTarget).toBe(2);
  });

  it('does not judge reps that had no target', () => {
    const summary = summariseSession(active, sessions, T(60), () => null);
    expect(summary.targeted).toBe(0);
    expect(summary.onTarget).toBe(0);
    // Distance still counts; only the verdict is withheld.
    expect(summary.distanceMeters).toBe(2400);
  });

  it('handles a session where nothing was logged', () => {
    const empty: ActiveSession = { ...active, entries: [] };
    const summary = summariseSession(empty, sessions, T(60), () => target);
    expect(summary.loggedEntries).toBe(0);
    expect(summary.distanceMeters).toBe(0);
    expect(summary.prescribedEntries).toBe(4);
  });
});
