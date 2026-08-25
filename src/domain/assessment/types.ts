import type { IsoDateTime, PerformanceCategory, Uuid } from '@/domain/types';

/**
 * The standardised assessment battery. These are the events an athlete tests
 * themselves on, and the only inputs the readiness engine scores.
 *
 * Deliberately small. Every event added here has to be benchmarked, entered by
 * hand on a phone, and repeated honestly every few weeks.
 */
export type AssessmentEventId =
  | 'pull_ups'
  | 'push_ups'
  | 'sit_ups'
  | 'run_1_mile'
  | 'run_1_5_mile'
  | 'swim_500m'
  | 'ruck_3_mile';

/** How a raw value is captured and displayed. */
export type MeasureUnit = 'reps' | 'seconds';

/**
 * Which direction counts as better. Time events improve as the number falls,
 * rep events as it rises. Every comparison, delta and benchmark lookup keys off
 * this rather than assuming.
 */
export type ScoreDirection = 'higher_is_better' | 'lower_is_better';

export interface AssessmentEvent {
  id: AssessmentEventId;
  name: string;
  /** Compact label for dense rows, e.g. "1.5 MILE". */
  shortName: string;
  category: PerformanceCategory;
  unit: MeasureUnit;
  direction: ScoreDirection;
  /** Test conditions. Shown at entry so results stay comparable over time. */
  protocol: string;
}

/** Standard load for the ruck assessment, in pounds. */
export const RUCK_ASSESSMENT_LOAD_POUNDS = 35;

export const ASSESSMENT_EVENTS: readonly AssessmentEvent[] = [
  {
    id: 'pull_ups',
    name: 'Pull-Ups',
    shortName: 'PULL-UPS',
    category: 'calisthenics',
    unit: 'reps',
    direction: 'higher_is_better',
    protocol: 'Maximum strict repetitions, dead hang, no kipping, one set.',
  },
  {
    id: 'push_ups',
    name: 'Push-Ups',
    shortName: 'PUSH-UPS',
    category: 'calisthenics',
    unit: 'reps',
    direction: 'higher_is_better',
    protocol: 'Maximum repetitions in two minutes. Rest only in the up position.',
  },
  {
    id: 'sit_ups',
    name: 'Sit-Ups',
    shortName: 'SIT-UPS',
    category: 'calisthenics',
    unit: 'reps',
    direction: 'higher_is_better',
    protocol: 'Maximum repetitions in two minutes.',
  },
  {
    id: 'run_1_mile',
    name: '1 Mile Run',
    shortName: '1 MILE',
    category: 'running',
    unit: 'seconds',
    direction: 'lower_is_better',
    protocol: 'One mile for time on a flat course or track.',
  },
  {
    id: 'run_1_5_mile',
    name: '1.5 Mile Run',
    shortName: '1.5 MILE',
    category: 'running',
    unit: 'seconds',
    direction: 'lower_is_better',
    protocol: 'One and a half miles for time on a flat course or track.',
  },
  {
    id: 'swim_500m',
    name: '500m Swim',
    shortName: '500M SWIM',
    category: 'swimming',
    unit: 'seconds',
    direction: 'lower_is_better',
    protocol: 'Continuous 500 metres for time, any stroke, no fins.',
  },
  {
    id: 'ruck_3_mile',
    name: '3 Mile Ruck',
    shortName: '3 MI RUCK',
    category: 'rucking',
    unit: 'seconds',
    direction: 'lower_is_better',
    protocol: `Three miles for time carrying ${RUCK_ASSESSMENT_LOAD_POUNDS} lb on a flat course.`,
  },
] as const;

const EVENTS_BY_ID = new Map<AssessmentEventId, AssessmentEvent>(
  ASSESSMENT_EVENTS.map((event) => [event.id, event]),
);

export function findAssessmentEvent(id: AssessmentEventId): AssessmentEvent | undefined {
  return EVENTS_BY_ID.get(id);
}

/** Events belonging to a category, in catalog order. */
export function eventsForCategory(category: PerformanceCategory): readonly AssessmentEvent[] {
  return ASSESSMENT_EVENTS.filter((event) => event.category === category);
}

/**
 * A single recorded performance. Append-only: retesting creates a new row so
 * the athlete never loses history, and trends stay honest.
 * Mirrors the `assessment_results` table.
 */
export interface AssessmentResult {
  id: Uuid;
  athleteId: Uuid;
  eventId: AssessmentEventId;
  /** Reps, or seconds, per the event unit. */
  value: number;
  recordedAt: IsoDateTime;
  notes: string | null;
}

/**
 * Returns the most recent result per event.
 *
 * Readiness always scores the latest performance rather than the best one: the
 * score answers "where am I now", not "what was I capable of once". Personal
 * records are tracked separately.
 */
export function latestResultByEvent(
  results: readonly AssessmentResult[],
): Map<AssessmentEventId, AssessmentResult> {
  const latest = new Map<AssessmentEventId, AssessmentResult>();

  for (const result of results) {
    const existing = latest.get(result.eventId);
    if (!existing || result.recordedAt > existing.recordedAt) {
      latest.set(result.eventId, result);
    }
  }

  return latest;
}

/** True when `candidate` beats `previous` for the given event. */
export function isImprovement(
  event: AssessmentEvent,
  candidate: number,
  previous: number,
): boolean {
  return event.direction === 'lower_is_better' ? candidate < previous : candidate > previous;
}
