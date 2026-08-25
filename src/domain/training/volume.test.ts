import type { WorkoutResult } from './types';
import { totalDistance, totalSessions, volumeToDate, weeklyVolume } from './volume';

function day(year: number, month: number, date: number, hour = 12): string {
  return new Date(year, month - 1, date, hour).toISOString();
}

let counter = 0;
function result(completedAt: string, distanceMeters?: number): WorkoutResult {
  counter += 1;
  return {
    id: `w${counter}`,
    athleteId: 'a',
    workoutSessionId: 'd1',
    completedAt,
    durationSeconds: 3600,
    rpe: 7,
    notes: null,
    ...(distanceMeters === undefined ? {} : { distanceMeters }),
  };
}

const START = day(2026, 8, 3);

describe('weeklyVolume', () => {
  it('returns one bucket per programme week', () => {
    const buckets = weeklyVolume([], START, 8);
    expect(buckets).toHaveLength(8);
    expect(buckets[0]?.weekNumber).toBe(1);
    expect(buckets[7]?.weekNumber).toBe(8);
  });

  // A missed week is information. Collapsing it would make it look like it
  // never existed.
  it('keeps weeks with no training as empty buckets', () => {
    const buckets = weeklyVolume([result(day(2026, 8, 4), 8000)], START, 4);
    expect(buckets[0]?.sessions).toBe(1);
    expect(buckets[1]?.sessions).toBe(0);
    expect(buckets[1]?.distanceMeters).toBe(0);
  });

  it('buckets results into the right programme week', () => {
    const buckets = weeklyVolume(
      [
        result(day(2026, 8, 3), 5000), // week 1, day 1
        result(day(2026, 8, 9), 3000), // week 1, day 7
        result(day(2026, 8, 10), 7000), // week 2, day 1
      ],
      START,
      4,
    );
    expect(buckets[0]?.distanceMeters).toBe(8000);
    expect(buckets[0]?.sessions).toBe(2);
    expect(buckets[1]?.distanceMeters).toBe(7000);
    expect(buckets[1]?.sessions).toBe(1);
  });

  // Records written before the distance field existed must not break the chart.
  it('treats a missing distance as zero rather than NaN', () => {
    const buckets = weeklyVolume([result(day(2026, 8, 4))], START, 2);
    expect(buckets[0]?.distanceMeters).toBe(0);
    expect(buckets[0]?.sessions).toBe(1);
  });

  it('sums duration alongside distance', () => {
    const buckets = weeklyVolume([result(day(2026, 8, 4), 5000), result(day(2026, 8, 5), 5000)], START, 2);
    expect(buckets[0]?.durationSeconds).toBe(7200);
  });

  it('ignores results from before the programme started', () => {
    const buckets = weeklyVolume([result(day(2026, 7, 20), 9000)], START, 4);
    expect(totalSessions(buckets)).toBe(0);
  });

  it('ignores results after the programme ended', () => {
    const buckets = weeklyVolume([result(day(2026, 12, 1), 9000)], START, 4);
    expect(totalSessions(buckets)).toBe(0);
  });

  it('returns nothing for unusable input', () => {
    expect(weeklyVolume([], 'nonsense', 8)).toEqual([]);
    expect(weeklyVolume([], START, 0)).toEqual([]);
  });
});

describe('volumeToDate', () => {
  it('trims weeks the athlete has not reached', () => {
    const buckets = weeklyVolume([], START, 8);
    expect(volumeToDate(buckets, 3)).toHaveLength(3);
  });
});

describe('totals', () => {
  it('sums distance and sessions across buckets', () => {
    const buckets = weeklyVolume(
      [result(day(2026, 8, 4), 8000), result(day(2026, 8, 12), 6000)],
      START,
      4,
    );
    expect(totalDistance(buckets)).toBe(14000);
    expect(totalSessions(buckets)).toBe(2);
  });
});
