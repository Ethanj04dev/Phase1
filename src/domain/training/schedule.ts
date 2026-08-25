import type { IsoDateTime } from '@/domain/types';

/**
 * Where an athlete sits in their programme.
 *
 * Position is derived from the calendar rather than from completed sessions.
 * That is a deliberate MVP simplification: the programme runs on real days, so
 * missing Tuesday does not leave the athlete permanently one day behind
 * everyone else. Pausing and resuming a programme is a later feature, and it
 * belongs in the athlete_programs record rather than here.
 */

export interface SchedulePosition {
  /** 1-based week within the programme. */
  weekNumber: number;
  /** 1-based day within the week, 1-7. */
  dayNumber: number;
  /** Days elapsed since the programme started, 0-based. */
  dayIndex: number;
  /** True once the athlete has run past the end of the programme. */
  completed: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Midnight local time for an instant.
 *
 * Day boundaries have to fall at local midnight, not at whatever time of day
 * the athlete happened to sign up, or "today's session" would change in the
 * middle of an afternoon.
 */
function startOfLocalDay(iso: IsoDateTime): number | null {
  const parsed = new Date(iso);
  const time = parsed.getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

export function positionFor(
  startedAt: IsoDateTime,
  now: IsoDateTime,
  durationWeeks: number,
): SchedulePosition | null {
  const start = startOfLocalDay(startedAt);
  const today = startOfLocalDay(now);
  if (start === null || today === null || durationWeeks <= 0) {
    return null;
  }

  // Rounded, because daylight saving shifts make the raw difference land a
  // fraction either side of a whole number of days.
  const elapsed = Math.max(0, Math.round((today - start) / MS_PER_DAY));

  const totalDays = durationWeeks * 7;
  const completed = elapsed >= totalDays;
  // Once finished, hold at the final day rather than running off the end.
  const dayIndex = completed ? totalDays - 1 : elapsed;

  return {
    weekNumber: Math.floor(dayIndex / 7) + 1,
    dayNumber: (dayIndex % 7) + 1,
    dayIndex,
    completed,
  };
}
