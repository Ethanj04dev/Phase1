import type { DayState } from '@/domain/training/weekState';
import type { ColorToken } from '@/theme';

/**
 * How each day state reads and looks.
 *
 * The word is the primary signal and the colour is support, never the other
 * way round. A week whose meaning is carried in green and amber is a week an
 * athlete with colour blindness cannot read, and a state list is exactly the
 * kind of thing that fails that way quietly.
 */

export const DAY_STATE_LABELS: Record<DayState, string | null> = {
  done: 'Logged',
  today: 'Today',
  unlogged: 'Not logged',
  // Upcoming is the default condition of a programme, so it gets no marker.
  // Labelling every future day would drown the three states that matter.
  upcoming: null,
  rest: 'Rest',
};

export const DAY_STATE_COLORS: Record<DayState, ColorToken> = {
  done: 'statusOnTarget',
  today: 'accent',
  unlogged: 'textTertiary',
  upcoming: 'textTertiary',
  rest: 'textTertiary',
};

/**
 * Colour of the rail beside a day.
 *
 * Only states that need finding at a glance get one. Everything else stays
 * transparent so the two that matter actually stand out.
 */
export function dayRailColor(state: DayState): ColorToken | null {
  if (state === 'today') {
    return 'accent';
  }
  return state === 'done' ? 'statusOnTarget' : null;
}

/** A week summarised in one line, or null when there is nothing to report. */
export function weekProgressSummary(progress: {
  done: number;
  unlogged: number;
  remaining: number;
  trainingDays: number;
}): string | null {
  if (progress.trainingDays === 0) {
    return null;
  }

  const parts = [`${progress.done} of ${progress.trainingDays} logged`];
  if (progress.unlogged > 0) {
    parts.push(`${progress.unlogged} not logged`);
  }
  if (progress.remaining > 0) {
    parts.push(`${progress.remaining} to go`);
  }
  return parts.join(' · ');
}
