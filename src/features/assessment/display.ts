import type { AssessmentEvent } from '@/domain/assessment/types';
import { formatDuration } from '@/lib/format';

/**
 * Rendering assessment values needs to know the event, because the same number
 * means repetitions for one event and seconds for another. Keeping these
 * helpers in one place stops every screen from re-deriving that rule.
 */

/** A recorded performance, e.g. "18" or "9:28". */
export function formatEventValue(event: AssessmentEvent, value: number): string {
  return event.unit === 'seconds' ? formatDuration(value) : String(Math.round(value));
}

/**
 * A magnitude of change, e.g. "1:14" faster or "8" more repetitions. Always
 * unsigned: the direction is carried by the surrounding UI, which knows whether
 * the change was an improvement.
 */
export function formatEventDelta(event: AssessmentEvent, delta: number): string {
  const magnitude = Math.abs(delta);
  return event.unit === 'seconds' ? formatDuration(magnitude) : String(Math.round(magnitude));
}

/** Trailing unit for a value, or null when the formatted value already reads clearly. */
export function eventUnitLabel(event: AssessmentEvent): string | null {
  return event.unit === 'reps' ? 'REPS' : null;
}
