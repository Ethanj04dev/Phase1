import type { ResolvedWorkoutDay } from './types';

/**
 * What a day in the programme currently is.
 *
 * The Train screen used to draw every day identically, which made a week
 * impossible to read: an athlete could not tell at a glance what they had
 * done, what was left, or what had slipped past them.
 *
 * "unlogged" rather than "missed" is deliberate. The app does not know whether
 * someone trained; it knows whether they told it. Accusing an athlete of
 * missing a session they actually did, and simply did not log, is both wrong
 * and the kind of nagging this product does not do.
 */
export type DayState = 'done' | 'today' | 'unlogged' | 'upcoming' | 'rest';

export interface DayStateInput {
  day: ResolvedWorkoutDay;
  /** Week the day belongs to. */
  weekNumber: number;
  /** Where the athlete actually is. Null when the position is unknown. */
  currentWeek: number | null;
  currentDay: number | null;
  /** Whether a finished workout exists for this day. */
  completed: boolean;
}

export function dayState({
  day,
  weekNumber,
  currentWeek,
  currentDay,
  completed,
}: DayStateInput): DayState {
  // Evidence first. A logged session is a fact, and it outranks every
  // inference drawn from the calendar.
  if (completed) {
    return 'done';
  }
  if (day.restDay) {
    return 'rest';
  }
  // Without a position there is no past and no future, so nothing can be
  // called overdue. Silence beats a guess that reads as an accusation.
  if (currentWeek === null || currentDay === null) {
    return 'upcoming';
  }

  if (weekNumber < currentWeek) {
    return 'unlogged';
  }
  if (weekNumber > currentWeek) {
    return 'upcoming';
  }
  if (day.dayNumber < currentDay) {
    return 'unlogged';
  }
  return day.dayNumber === currentDay ? 'today' : 'upcoming';
}

export interface WeekProgress {
  /** Days with a logged session. */
  done: number;
  /** Training days already past with nothing logged. */
  unlogged: number;
  /** Training days still ahead, including today. */
  remaining: number;
  /** Training days in the week. Rest days are not work and are not counted. */
  trainingDays: number;
}

/**
 * A week read as a whole.
 *
 * Rest days sit outside every count, so a fully compliant week reads as
 * complete rather than being capped by the calendar.
 */
export function weekProgress(states: readonly DayState[]): WeekProgress {
  const done = states.filter((state) => state === 'done').length;
  const unlogged = states.filter((state) => state === 'unlogged').length;
  const remaining = states.filter(
    (state) => state === 'today' || state === 'upcoming',
  ).length;

  return { done, unlogged, remaining, trainingDays: done + unlogged + remaining };
}
