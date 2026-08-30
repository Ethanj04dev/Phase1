import type { IsoDate, IsoDateTime } from '@/domain/types';

/**
 * The countdown to a known selection date.
 *
 * No competitor anchors training to the athlete's actual event: plans are
 * generic twelve-week blocks that start whenever. A candidate with fourteen
 * weeks to selection trains differently from one with forty, and the whole
 * product reads differently once a real date sits behind it.
 *
 * The date is the athlete's own claim, like a milestone: Zero Phase records it,
 * cannot verify it, and never presents the countdown as anything other than
 * arithmetic against what they entered.
 */

export type Countdown =
  | { state: 'none' }
  | { state: 'future'; days: number; weeks: number }
  | { state: 'this_week'; days: number }
  | { state: 'past' };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A date-only string parsed as a local calendar day.
 *
 * `new Date('2026-09-11')` reads as UTC midnight, which is the *previous*
 * local day anywhere west of Greenwich — an off-by-one that would make every
 * countdown in the Americas wrong. The components are read directly instead.
 */
function localDayFromDateOnly(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  const valid =
    parsed.getFullYear() === Number(year) &&
    parsed.getMonth() === Number(month) - 1 &&
    parsed.getDate() === Number(day);
  return valid ? parsed.getTime() : null;
}

/** Local start-of-day for a full timestamp. */
function startOfLocalDay(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function countdownTo(
  selectionDate: IsoDate | null | undefined,
  now: IsoDateTime,
): Countdown {
  if (!selectionDate) {
    return { state: 'none' };
  }
  const target = localDayFromDateOnly(selectionDate);
  const today = startOfLocalDay(now);
  if (target === null || today === null) {
    return { state: 'none' };
  }

  const days = Math.round((target - today) / MS_PER_DAY);
  if (days < 0) {
    return { state: 'past' };
  }
  if (days < 7) {
    return { state: 'this_week', days };
  }
  // Floor, not ceil. "14 weeks out" should still be true on the first day of
  // those fourteen weeks; rounding up would have the count lie high all week.
  return { state: 'future', days, weeks: Math.floor(days / 7) };
}

/** The one-line reading, or null when there is nothing to say. */
export function countdownLabel(countdown: Countdown): string | null {
  switch (countdown.state) {
    case 'none':
      return null;
    case 'past':
      // Their event has been. The product does not know how it went, and
      // guessing in either direction would be worse than saying nothing more.
      return 'Your selection date has passed';
    case 'this_week':
      return countdown.days === 0
        ? 'Selection day'
        : `${countdown.days} ${countdown.days === 1 ? 'day' : 'days'} to selection`;
    case 'future':
      return `${countdown.weeks} ${countdown.weeks === 1 ? 'week' : 'weeks'} to selection`;
  }
}

/**
 * Parses athlete input for the date, strictly.
 *
 * Only the unambiguous form is accepted. "03/04/2027" means two different
 * days on two sides of the Atlantic, and a countdown built on a misread date
 * would be confidently wrong for months.
 */
export function parseSelectionDateInput(text: string): IsoDate | null {
  const trimmed = text.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  const valid =
    parsed.getFullYear() === Number(year) &&
    parsed.getMonth() === Number(month) - 1 &&
    parsed.getDate() === Number(day);
  return valid ? trimmed : null;
}
