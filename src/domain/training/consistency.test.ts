import { streakDays, weekStartFor, weeklyCompletion } from './consistency';

/** Local-time ISO so assertions do not depend on the test timezone. */
function day(year: number, month: number, date: number, hour = 12): string {
  return new Date(year, month - 1, date, hour).toISOString();
}

const NOW = day(2026, 8, 25, 9);

describe('streakDays', () => {
  it('is zero with no completed workouts', () => {
    expect(streakDays([], NOW)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const completed = [day(2026, 8, 23), day(2026, 8, 24), day(2026, 8, 25)];
    expect(streakDays(completed, NOW)).toBe(3);
  });

  // A streak should not look broken at 9am just because today's session has
  // not happened yet.
  it('anchors on yesterday when today has no session', () => {
    const completed = [day(2026, 8, 23), day(2026, 8, 24)];
    expect(streakDays(completed, NOW)).toBe(2);
  });

  it('breaks once a full day is missed', () => {
    // Nothing on the 24th, so the run ending on the 23rd is already dead.
    const completed = [day(2026, 8, 21), day(2026, 8, 22), day(2026, 8, 23)];
    expect(streakDays(completed, NOW)).toBe(0);
  });

  it('counts two sessions on one day once', () => {
    const completed = [day(2026, 8, 25, 7), day(2026, 8, 25, 18), day(2026, 8, 24)];
    expect(streakDays(completed, NOW)).toBe(2);
  });

  it('counts a late-evening session on the day it happened', () => {
    const completed = [day(2026, 8, 24, 23), day(2026, 8, 25, 8)];
    expect(streakDays(completed, NOW)).toBe(2);
  });

  it('ignores unparseable timestamps', () => {
    expect(streakDays(['nonsense', day(2026, 8, 25)], NOW)).toBe(1);
  });

  it('is unaffected by ordering', () => {
    const completed = [day(2026, 8, 25), day(2026, 8, 23), day(2026, 8, 24)];
    expect(streakDays(completed, NOW)).toBe(3);
    expect(streakDays([...completed].reverse(), NOW)).toBe(3);
  });
});

describe('weeklyCompletion', () => {
  const weekStart = day(2026, 8, 24, 0);

  it('is zero when nothing has been done', () => {
    expect(weeklyCompletion([], weekStart, 5)).toBe(0);
  });

  it('counts distinct days inside the week', () => {
    const completed = [day(2026, 8, 24), day(2026, 8, 25), day(2026, 8, 26)];
    expect(weeklyCompletion(completed, weekStart, 5)).toBeCloseTo(0.6, 5);
  });

  it('excludes days outside the week window', () => {
    const completed = [day(2026, 8, 23), day(2026, 8, 24), day(2026, 8, 31)];
    expect(weeklyCompletion(completed, weekStart, 5)).toBeCloseTo(0.2, 5);
  });

  // Rest days are not in the denominator, so a fully compliant week reads 100.
  it('reaches full completion without requiring seven days', () => {
    const completed = [
      day(2026, 8, 24), day(2026, 8, 25), day(2026, 8, 26),
      day(2026, 8, 27), day(2026, 8, 28),
    ];
    expect(weeklyCompletion(completed, weekStart, 5)).toBe(1);
  });

  it('never exceeds one', () => {
    const completed = [
      day(2026, 8, 24), day(2026, 8, 25), day(2026, 8, 26),
      day(2026, 8, 27), day(2026, 8, 28), day(2026, 8, 29),
    ];
    expect(weeklyCompletion(completed, weekStart, 5)).toBe(1);
  });

  it('is zero when the week prescribes no training', () => {
    expect(weeklyCompletion([day(2026, 8, 24)], weekStart, 0)).toBe(0);
  });
});

describe('weekStartFor', () => {
  it('returns the programme start for week 1', () => {
    const start = weekStartFor(day(2026, 8, 3, 14), 1);
    expect(new Date(start!).getDate()).toBe(3);
  });

  it('advances seven days per week', () => {
    const start = weekStartFor(day(2026, 8, 3, 14), 3);
    expect(new Date(start!).getDate()).toBe(17);
  });

  it('rejects an invalid week', () => {
    expect(weekStartFor(day(2026, 8, 3), 0)).toBeNull();
  });
});
