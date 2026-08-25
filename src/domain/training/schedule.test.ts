import { positionFor } from './schedule';

/** Local-time ISO strings, so the assertions do not depend on the test timezone. */
function localIso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const START = localIso(2026, 8, 3); // day 1 of the programme
const DURATION_WEEKS = 8;

describe('positionFor', () => {
  it('puts the first day at week 1 day 1', () => {
    const position = positionFor(START, START, DURATION_WEEKS);
    expect(position).toEqual({
      weekNumber: 1,
      dayNumber: 1,
      dayIndex: 0,
      completed: false,
    });
  });

  it('advances a day at a time', () => {
    expect(positionFor(START, localIso(2026, 8, 4), DURATION_WEEKS)?.dayNumber).toBe(2);
    expect(positionFor(START, localIso(2026, 8, 9), DURATION_WEEKS)?.dayNumber).toBe(7);
  });

  it('rolls into the next week after seven days', () => {
    const position = positionFor(START, localIso(2026, 8, 10), DURATION_WEEKS);
    expect(position?.weekNumber).toBe(2);
    expect(position?.dayNumber).toBe(1);
  });

  // The day must turn over at local midnight, not at the sign-up time.
  it('does not advance within the same calendar day', () => {
    const earlyStart = localIso(2026, 8, 3, 6);
    const lateSameDay = localIso(2026, 8, 3, 23);
    expect(positionFor(earlyStart, lateSameDay, DURATION_WEEKS)?.dayNumber).toBe(1);
  });

  it('turns over at midnight even when barely any time has passed', () => {
    const lateStart = localIso(2026, 8, 3, 23);
    const earlyNextDay = localIso(2026, 8, 4, 1);
    expect(positionFor(lateStart, earlyNextDay, DURATION_WEEKS)?.dayNumber).toBe(2);
  });

  it('clamps a clock skewed into the past to day 1', () => {
    const position = positionFor(START, localIso(2026, 7, 20), DURATION_WEEKS);
    expect(position?.dayIndex).toBe(0);
    expect(position?.completed).toBe(false);
  });

  it('holds at the final day once the programme is finished', () => {
    // Eight weeks is 56 days, so day index 55 is the last.
    const past = positionFor(START, localIso(2026, 12, 25), DURATION_WEEKS);
    expect(past?.completed).toBe(true);
    expect(past?.weekNumber).toBe(DURATION_WEEKS);
    expect(past?.dayNumber).toBe(7);
    expect(past?.dayIndex).toBe(55);
  });

  it('marks the day after the final day as complete', () => {
    const lastDay = positionFor(START, localIso(2026, 9, 27), DURATION_WEEKS);
    expect(lastDay?.completed).toBe(false);
    expect(lastDay?.dayIndex).toBe(55);

    const dayAfter = positionFor(START, localIso(2026, 9, 28), DURATION_WEEKS);
    expect(dayAfter?.completed).toBe(true);
  });

  it('returns null for unusable input', () => {
    expect(positionFor('not-a-date', START, DURATION_WEEKS)).toBeNull();
    expect(positionFor(START, 'not-a-date', DURATION_WEEKS)).toBeNull();
    expect(positionFor(START, START, 0)).toBeNull();
  });
});
