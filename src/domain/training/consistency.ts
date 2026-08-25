import type { IsoDateTime } from '@/domain/types';

/**
 * Streak and weekly completion, derived from finished workouts.
 *
 * Both describe what the athlete actually did, so both are computed from
 * results rather than stored counters. A stored streak drifts the first time a
 * write fails, and a drifted streak is worse than none.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local calendar day key, so a session at 23:50 counts for that day. */
function dayKeyOf(iso: IsoDateTime): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfLocalDay(iso: IsoDateTime): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Consecutive days ending today or yesterday that contain a finished workout.
 *
 * Yesterday counts as the anchor so the streak does not appear broken at
 * breakfast simply because today's session has not happened yet. It breaks
 * only once a full day has been missed.
 */
export function streakDays(completedAt: readonly IsoDateTime[], now: IsoDateTime): number {
  const today = startOfLocalDay(now);
  if (today === null) {
    return 0;
  }

  const days = new Set<string>();
  for (const timestamp of completedAt) {
    const key = dayKeyOf(timestamp);
    if (key !== null) {
      days.add(key);
    }
  }
  if (days.size === 0) {
    return 0;
  }

  const keyForOffset = (offset: number): string => {
    const date = new Date(today - offset * MS_PER_DAY);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  // Anchor on today if it has a session, otherwise on yesterday.
  let offset = days.has(keyForOffset(0)) ? 0 : 1;
  if (!days.has(keyForOffset(offset))) {
    return 0;
  }

  let streak = 0;
  while (days.has(keyForOffset(offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

/**
 * Fraction of this programme week's training days that have been completed.
 *
 * Rest days are excluded from the denominator: an athlete who did everything
 * asked of them should read 100 percent, not 71.
 */
export function weeklyCompletion(
  completedAt: readonly IsoDateTime[],
  weekStart: IsoDateTime,
  trainingDaysInWeek: number,
): number {
  if (trainingDaysInWeek <= 0) {
    return 0;
  }
  const start = startOfLocalDay(weekStart);
  if (start === null) {
    return 0;
  }
  const end = start + 7 * MS_PER_DAY;

  const days = new Set<string>();
  for (const timestamp of completedAt) {
    const dayStart = startOfLocalDay(timestamp);
    const key = dayKeyOf(timestamp);
    if (dayStart === null || key === null) {
      continue;
    }
    if (dayStart >= start && dayStart < end) {
      days.add(key);
    }
  }

  return Math.min(1, days.size / trainingDaysInWeek);
}

/** Start of a programme week, given when the athlete started the programme. */
export function weekStartFor(programStart: IsoDateTime, weekNumber: number): string | null {
  const start = startOfLocalDay(programStart);
  if (start === null || weekNumber < 1) {
    return null;
  }
  return new Date(start + (weekNumber - 1) * 7 * MS_PER_DAY).toISOString();
}
