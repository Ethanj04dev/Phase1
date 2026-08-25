import type { IsoDateTime } from '@/domain/types';

import {
  findAssessmentEvent,
  isImprovement,
  type AssessmentEvent,
  type AssessmentEventId,
  type AssessmentResult,
} from './types';

/**
 * Personal records and per-event progress, derived from result history rather
 * than stored.
 *
 * Deriving is the right call here: a stored PR can drift out of sync with the
 * results it summarises, and there is no volume of history where recomputing
 * is expensive. If that ever changes, this is a caching problem, not a schema
 * problem.
 */

export interface PersonalRecord {
  event: AssessmentEvent;
  value: number;
  /** When the record was *first* set, not the last time it was matched. */
  achievedAt: IsoDateTime;
}

/** Chronological history for one event, plus the numbers the UI reports. */
export interface EventProgress {
  event: AssessmentEvent;
  /** Oldest first. */
  history: readonly AssessmentResult[];
  first: AssessmentResult | null;
  latest: AssessmentResult | null;
  /** The result immediately before the latest, if there is one. */
  previous: AssessmentResult | null;
  best: PersonalRecord | null;
  /**
   * How much better the latest result is than the first, in event units and
   * always signed so that positive means improvement. Null until there are two
   * results to compare.
   */
  improvement: number | null;
}

function chronological(results: readonly AssessmentResult[]): AssessmentResult[] {
  return [...results].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

/**
 * Groups results by event, oldest first. Results for events the catalog no
 * longer knows about are dropped rather than crashing the screen.
 */
export function groupResultsByEvent(
  results: readonly AssessmentResult[],
): Map<AssessmentEventId, AssessmentResult[]> {
  const grouped = new Map<AssessmentEventId, AssessmentResult[]>();

  for (const result of results) {
    if (!findAssessmentEvent(result.eventId)) {
      continue;
    }
    const bucket = grouped.get(result.eventId);
    if (bucket) {
      bucket.push(result);
    } else {
      grouped.set(result.eventId, [result]);
    }
  }

  for (const [eventId, bucket] of grouped) {
    grouped.set(eventId, chronological(bucket));
  }

  return grouped;
}

/** The best performance for one event, or null when it has never been tested. */
export function personalRecordFor(
  event: AssessmentEvent,
  results: readonly AssessmentResult[],
): PersonalRecord | null {
  let best: AssessmentResult | null = null;

  for (const result of chronological(results)) {
    // Strict improvement only, so a later result that merely matches the
    // record does not move the date. The PR belongs to the day it was set.
    if (!best || isImprovement(event, result.value, best.value)) {
      best = result;
    }
  }

  return best ? { event, value: best.value, achievedAt: best.recordedAt } : null;
}

export function buildEventProgress(
  event: AssessmentEvent,
  results: readonly AssessmentResult[],
): EventProgress {
  const history = chronological(results);
  const first = history[0] ?? null;
  const latest = history.length > 0 ? (history[history.length - 1] ?? null) : null;
  const previous = history.length > 1 ? (history[history.length - 2] ?? null) : null;

  let improvement: number | null = null;
  if (first && latest && first !== latest) {
    improvement =
      event.direction === 'lower_is_better'
        ? first.value - latest.value
        : latest.value - first.value;
  }

  return {
    event,
    history,
    first,
    latest,
    previous,
    best: personalRecordFor(event, history),
    improvement,
  };
}

/** Progress for every event that has at least one result, in catalog order. */
export function buildAllEventProgress(
  events: readonly AssessmentEvent[],
  results: readonly AssessmentResult[],
): EventProgress[] {
  const grouped = groupResultsByEvent(results);

  return events.flatMap((event) => {
    const bucket = grouped.get(event.id);
    return bucket && bucket.length > 0 ? [buildEventProgress(event, bucket)] : [];
  });
}

/** Every personal record the athlete holds, in catalog order. */
export function buildPersonalRecords(
  events: readonly AssessmentEvent[],
  results: readonly AssessmentResult[],
): PersonalRecord[] {
  const grouped = groupResultsByEvent(results);

  return events.flatMap((event) => {
    const bucket = grouped.get(event.id);
    if (!bucket || bucket.length === 0) {
      return [];
    }
    const record = personalRecordFor(event, bucket);
    return record ? [record] : [];
  });
}

/** True when this result is the best the athlete has ever recorded for the event. */
export function isPersonalRecord(
  event: AssessmentEvent,
  candidate: AssessmentResult,
  history: readonly AssessmentResult[],
): boolean {
  const others = history.filter((result) => result.id !== candidate.id);
  if (others.length === 0) {
    return true;
  }
  const previousBest = personalRecordFor(event, others);
  return previousBest === null || isImprovement(event, candidate.value, previousBest.value);
}
