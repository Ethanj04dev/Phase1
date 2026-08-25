import { describeSession, totalEstimatedMinutes } from './describe';
import type { WorkoutBlock, WorkoutSession } from './types';

function session(blocks: WorkoutBlock[], estimatedMinutes = 30): WorkoutSession {
  return {
    id: 's1',
    workoutDayId: 'd1',
    order: 1,
    modality: 'running',
    title: 'Session',
    estimatedMinutes,
    blocks,
  };
}

const warmUp: WorkoutBlock = {
  id: 'b1',
  order: 1,
  kind: 'steady',
  name: 'Warm-up',
  distanceMeters: 1200,
  effort: { rpe: 3 },
};

const coolDown: WorkoutBlock = {
  id: 'b3',
  order: 3,
  kind: 'steady',
  name: 'Cool-down',
  distanceMeters: 1000,
  effort: { rpe: 2 },
};

describe('describeSession', () => {
  it('describes the interval work, not the warm-up', () => {
    const intervals: WorkoutBlock = {
      id: 'b2',
      order: 2,
      kind: 'interval',
      name: '800m repeats',
      reps: 6,
      distanceMeters: 800,
      recoverySeconds: 120,
      target: { basis: 'mile_time', factor: 0.94, toleranceSeconds: 5 },
    };
    expect(describeSession(session([warmUp, intervals, coolDown]))).toBe('6 x 800m');
  });

  // The bug this test exists for: a tempo session is all steady blocks, and
  // picking the first non-recovery one summarised it as its own warm-up.
  it('describes the tempo work, not the warm-up that precedes it', () => {
    const tempo: WorkoutBlock = {
      id: 'b2',
      order: 2,
      kind: 'steady',
      name: 'Tempo',
      distanceMeters: 3200,
      target: { basis: 'one_and_half_mile_time', factor: 1.08, toleranceSeconds: 20 },
    };
    expect(describeSession(session([warmUp, tempo, coolDown]))).toBe('2 mi');
  });

  it('falls back to the longest block when nothing carries a target', () => {
    const easy: WorkoutBlock = {
      id: 'b2',
      order: 2,
      kind: 'steady',
      name: 'Easy aerobic run',
      distanceMeters: 8000,
      effort: { rpe: 4 },
    };
    expect(describeSession(session([warmUp, easy]))).toBe('5 mi');
  });

  it('describes a swim set by its repetitions', () => {
    const swim: WorkoutBlock = {
      id: 'b1',
      order: 1,
      kind: 'swim',
      name: '100m repeats',
      reps: 8,
      distanceMeters: 100,
      restSeconds: 30,
      effort: { rpe: 4 },
    };
    expect(describeSession(session([swim]))).toBe('8 x 100m');
  });

  it('describes a calisthenics session by its first block', () => {
    const pullUps: WorkoutBlock = {
      id: 'b1',
      order: 1,
      kind: 'calisthenics',
      name: 'Pull-ups',
      sets: 5,
      reps: 'max',
      restSeconds: 120,
    };
    expect(describeSession(session([pullUps]))).toBe('5 x max');
  });

  it('returns an empty string for a session with no blocks', () => {
    expect(describeSession(session([]))).toBe('');
  });
});

describe('totalEstimatedMinutes', () => {
  it('sums the sessions of a day', () => {
    expect(totalEstimatedMinutes([session([], 45), session([], 22)])).toBe(67);
  });

  it('is zero for a rest day', () => {
    expect(totalEstimatedMinutes([])).toBe(0);
  });
});
