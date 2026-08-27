import type { ResolvedWorkoutDay } from './types';
import { dayState, weekProgress, type DayState } from './weekState';

function day(dayNumber: number, restDay = false): ResolvedWorkoutDay {
  return {
    id: `d${dayNumber}`,
    programWeekId: 'w1',
    dayNumber,
    title: restDay ? 'Recovery' : `Day ${dayNumber}`,
    description: '',
    restDay,
    sessions: [],
  };
}

function state(
  dayNumber: number,
  overrides: Partial<{
    weekNumber: number;
    currentWeek: number | null;
    currentDay: number | null;
    completed: boolean;
    restDay: boolean;
  }> = {},
): DayState {
  return dayState({
    day: day(dayNumber, overrides.restDay ?? false),
    weekNumber: overrides.weekNumber ?? 2,
    currentWeek: overrides.currentWeek === undefined ? 2 : overrides.currentWeek,
    currentDay: overrides.currentDay === undefined ? 3 : overrides.currentDay,
    completed: overrides.completed ?? false,
  });
}

describe('reading a day', () => {
  it('marks today', () => {
    expect(state(3)).toBe('today');
  });

  it('marks days still ahead in this week', () => {
    expect(state(4)).toBe('upcoming');
    expect(state(7)).toBe('upcoming');
  });

  it('marks training days already past with nothing logged', () => {
    expect(state(1)).toBe('unlogged');
    expect(state(2)).toBe('unlogged');
  });

  it('marks rest days as rest, whatever the calendar says', () => {
    expect(state(1, { restDay: true })).toBe('rest');
    expect(state(3, { restDay: true })).toBe('rest');
    expect(state(5, { restDay: true })).toBe('rest');
  });
});

describe('evidence outranks the calendar', () => {
  // The whole point of the state machine: what actually happened wins.
  it('marks a logged day done even when it is today', () => {
    expect(state(3, { completed: true })).toBe('done');
  });

  it('marks a logged day done even when it is in the future', () => {
    // Training ahead of schedule is not an error to be corrected on screen.
    expect(state(6, { completed: true })).toBe('done');
  });

  it('never calls a logged day unlogged', () => {
    expect(state(1, { completed: true })).toBe('done');
  });
});

describe('other weeks', () => {
  it('treats a past week with nothing logged as unlogged', () => {
    expect(state(4, { weekNumber: 1 })).toBe('unlogged');
  });

  it('treats a future week as upcoming, including days already numbered past', () => {
    expect(state(1, { weekNumber: 5 })).toBe('upcoming');
  });
});

describe('unknown position', () => {
  // A brand-new athlete, or a programme that has not started. Nothing can be
  // overdue yet, and saying otherwise would be an accusation built on nothing.
  it('accuses nobody of anything', () => {
    for (const dayNumber of [1, 2, 3, 4, 5, 6, 7]) {
      expect(state(dayNumber, { currentWeek: null, currentDay: null })).not.toBe('unlogged');
    }
  });

  it('still reports logged days and rest days truthfully', () => {
    expect(state(1, { currentWeek: null, currentDay: null, completed: true })).toBe('done');
    expect(state(1, { currentWeek: null, currentDay: null, restDay: true })).toBe('rest');
  });
});

describe('week progress', () => {
  it('excludes rest days from every count', () => {
    const progress = weekProgress(['done', 'rest', 'unlogged', 'rest', 'today', 'upcoming']);
    expect(progress).toEqual({ done: 1, unlogged: 1, remaining: 2, trainingDays: 4 });
  });

  it('counts today as still available rather than already lost', () => {
    expect(weekProgress(['today']).remaining).toBe(1);
    expect(weekProgress(['today']).unlogged).toBe(0);
  });

  it('reads a fully logged week as complete', () => {
    const progress = weekProgress(['done', 'done', 'rest', 'done']);
    expect(progress.done).toBe(progress.trainingDays);
    expect(progress.unlogged).toBe(0);
  });

  it('handles a week of nothing but rest', () => {
    expect(weekProgress(['rest', 'rest'])).toEqual({
      done: 0,
      unlogged: 0,
      remaining: 0,
      trainingDays: 0,
    });
  });
});
