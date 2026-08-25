import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';

import { convertRunTime, resolvePaceTarget } from './targets';
import type { PaceTarget } from './types';

let counter = 0;

function result(eventId: AssessmentEventId, value: number): AssessmentResult {
  counter += 1;
  return {
    id: `r${counter}`,
    athleteId: 'a',
    eventId,
    value,
    recordedAt: '2026-08-01T00:00:00.000Z',
    notes: null,
  };
}

const REPEAT_800: PaceTarget = {
  basis: 'mile_time',
  factor: 0.94,
  toleranceSeconds: 5,
};

describe('convertRunTime', () => {
  it('predicts a slower pace over a longer distance', () => {
    // A 6:00 mile does not translate to a 9:00 1.5 mile; fatigue costs time.
    const mile = 360;
    const converted = convertRunTime(mile, 1609.344, 2414.016);
    expect(converted).toBeGreaterThan(mile * 1.5);
    expect(converted).toBeLessThan(mile * 1.65);
  });

  it('round-trips approximately', () => {
    const there = convertRunTime(360, 1609.344, 2414.016);
    const back = convertRunTime(there, 2414.016, 1609.344);
    expect(back).toBeCloseTo(360, 5);
  });
});

describe('resolvePaceTarget', () => {
  // This is the acceptance criterion for the milestone: same session,
  // different athletes, different numbers.
  it('gives two athletes different targets for the same block', () => {
    const fast = resolvePaceTarget(REPEAT_800, 800, [result('run_1_mile', 400)]);
    const slower = resolvePaceTarget(REPEAT_800, 800, [result('run_1_mile', 480)]);

    expect(fast).not.toBeNull();
    expect(slower).not.toBeNull();
    expect(fast!.targetSeconds).toBeLessThan(slower!.targetSeconds);
  });

  it('scales pace by distance and factor', () => {
    // 6:40 mile = 400s over 1609.344m. An 800m rep at 94 percent of that pace.
    const resolved = resolvePaceTarget(REPEAT_800, 800, [result('run_1_mile', 400)]);
    const expected = (400 / 1609.344) * 800 * 0.94;
    expect(resolved?.targetSeconds).toBeCloseTo(expected, 6);
  });

  it('builds the window from the tolerance', () => {
    const resolved = resolvePaceTarget(REPEAT_800, 800, [result('run_1_mile', 400)]);
    expect(resolved).not.toBeNull();
    expect(resolved!.highSeconds - resolved!.lowSeconds).toBeCloseTo(10, 6);
    expect(resolved!.targetSeconds - resolved!.lowSeconds).toBeCloseTo(5, 6);
  });

  it('never opens the window below zero', () => {
    const brutal: PaceTarget = { basis: 'mile_time', factor: 0.5, toleranceSeconds: 600 };
    const resolved = resolvePaceTarget(brutal, 100, [result('run_1_mile', 400)]);
    expect(resolved!.lowSeconds).toBeGreaterThan(0);
  });

  it('marks a faster factor as a faster target', () => {
    const results = [result('run_1_mile', 400)];
    const easy = resolvePaceTarget({ ...REPEAT_800, factor: 1.05 }, 800, results);
    const hard = resolvePaceTarget({ ...REPEAT_800, factor: 0.9 }, 800, results);
    expect(hard!.targetSeconds).toBeLessThan(easy!.targetSeconds);
  });

  it('uses the latest result when an event has been retested', () => {
    const older: AssessmentResult = {
      ...result('run_1_mile', 480),
      recordedAt: '2026-01-01T00:00:00.000Z',
    };
    const newer: AssessmentResult = {
      ...result('run_1_mile', 400),
      recordedAt: '2026-08-01T00:00:00.000Z',
    };
    const resolved = resolvePaceTarget(REPEAT_800, 800, [older, newer]);
    const expected = (400 / 1609.344) * 800 * 0.94;
    expect(resolved?.targetSeconds).toBeCloseTo(expected, 6);
  });
});

describe('resolvePaceTarget fallbacks', () => {
  it('converts from the 1.5 mile when the mile is untested', () => {
    const resolved = resolvePaceTarget(REPEAT_800, 800, [result('run_1_5_mile', 600)]);
    expect(resolved).not.toBeNull();
    expect(resolved?.estimated).toBe(true);
  });

  it('marks a directly measured basis as not estimated', () => {
    const resolved = resolvePaceTarget(REPEAT_800, 800, [result('run_1_mile', 400)]);
    expect(resolved?.estimated).toBe(false);
  });

  it('prefers the direct measurement over a conversion', () => {
    const both = resolvePaceTarget(REPEAT_800, 800, [
      result('run_1_mile', 400),
      result('run_1_5_mile', 900),
    ]);
    const direct = resolvePaceTarget(REPEAT_800, 800, [result('run_1_mile', 400)]);
    expect(both?.targetSeconds).toBeCloseTo(direct!.targetSeconds, 6);
    expect(both?.estimated).toBe(false);
  });

  // Swimming and rucking have one measurable event each. Guessing a swim pace
  // from a run time would be inventing data.
  it('returns null for an untested swim basis rather than guessing', () => {
    const swim: PaceTarget = {
      basis: 'swim_500_time',
      factor: 1,
      toleranceSeconds: 5,
    };
    expect(resolvePaceTarget(swim, 100, [result('run_1_mile', 400)])).toBeNull();
  });

  it('returns null for an untested ruck basis', () => {
    const ruck: PaceTarget = { basis: 'ruck_pace', factor: 1, toleranceSeconds: 30 };
    expect(resolvePaceTarget(ruck, 3000, [result('run_1_mile', 400)])).toBeNull();
  });

  it('returns null when the athlete has tested nothing', () => {
    expect(resolvePaceTarget(REPEAT_800, 800, [])).toBeNull();
  });

  it('returns null for a nonsensical distance', () => {
    const results = [result('run_1_mile', 400)];
    expect(resolvePaceTarget(REPEAT_800, 0, results)).toBeNull();
    expect(resolvePaceTarget(REPEAT_800, -800, results)).toBeNull();
    expect(resolvePaceTarget(REPEAT_800, Number.NaN, results)).toBeNull();
  });
});
