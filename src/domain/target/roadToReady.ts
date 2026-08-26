import {
  findAssessmentEvent,
  latestResultByEvent,
  type AssessmentEventId,
  type AssessmentResult,
} from '@/domain/assessment/types';
import { PHASE1_TARGET_READINESS } from '@/domain/readiness/bands';
import type { TargetReadiness } from '@/domain/readiness/targetScore';

import { preparationDomain, type PreparationDomainId } from './domains';
import { phase1BenchmarkFor, type TargetDefinition, type TargetDomain } from './types';

/**
 * Road to Ready: the ordered answer to "what do I work on next".
 *
 * The engine exists because the honest answer is not "your worst domain". A
 * candidate whose rucking is poor and whose swim is mediocre should usually be
 * swimming, if this Target leans twice as hard on the water. Ranking by
 * weighted headroom rather than raw weakness is what makes the advice specific
 * to the Target instead of generic fitness coaching.
 *
 * Pure and deterministic. It takes a readiness result rather than recomputing
 * one, so the order shown here can never disagree with the score shown beside
 * it.
 */

/**
 * Why a step is on the list.
 *
 * The distinction between "improve" and "measure" is the whole point. Telling
 * someone to train harder at something they have never tested is advice built
 * on nothing; the useful instruction is to go and find out where they stand.
 */
export type RoadStepKind =
  /** Measured, below the benchmark. Train it. */
  | 'improve'
  /** Never measured. Test it before anything else is said about it. */
  | 'measure'
  /** Measured, at or above the benchmark. Keep it there. */
  | 'maintain'
  /** No safe or available assessment exists for this domain on this Target. */
  | 'unavailable';

export interface EventGap {
  eventId: AssessmentEventId;
  /** Latest recorded value in the event's own units. Null when untested. */
  current: number | null;
  /** The preparation benchmark, in the same units. */
  benchmark: number;
  /** Unsigned distance to the benchmark, in the event's units. Null when untested. */
  gap: number | null;
  /** True when the latest result already reaches the benchmark. */
  met: boolean;
}

export interface RoadStep {
  domainId: PreparationDomainId;
  kind: RoadStepKind;
  /** 0-100. Null when the domain is unmeasured or unmeasurable. */
  score: number | null;
  /** This domain's share of the readiness score, 0-1. */
  weight: number;
  /**
   * How much overall readiness is sitting on the table here: the domain's
   * weight multiplied by its distance from the benchmark. This is the sort
   * key, and it is exposed so the UI can show the athlete the arithmetic
   * rather than asking them to trust an ordering.
   */
  impact: number;
  /** Per-event detail, present only for domains with benchmarked events. */
  events: readonly EventGap[];
}

export interface RoadToReady {
  /** Highest impact first. Ties fall back to the Target's own domain order. */
  steps: readonly RoadStep[];
  /** Domains already at or above the benchmark. */
  atBenchmark: number;
  /** Share of the Target's weight that has never been measured, 0-1. */
  unmeasuredWeight: number;
  /** The single highest-impact step, or null when there is nothing to do. */
  focus: RoadStep | null;
}

/**
 * The score a domain is being driven towards.
 *
 * Not 100. Perfection is not the goal, and measuring every gap against it
 * would make a strong athlete's remaining work look as large as a beginner's.
 */
const DOMAIN_TARGET_SCORE = PHASE1_TARGET_READINESS;

function eventGaps(
  domain: TargetDomain,
  target: TargetDefinition,
  results: readonly AssessmentResult[],
): readonly EventGap[] {
  const latest = latestResultByEvent(results);

  return domain.eventIds.flatMap((eventId): EventGap[] => {
    const event = findAssessmentEvent(eventId);
    const benchmark = phase1BenchmarkFor(target, eventId);
    // An event with no benchmark has nothing to be measured against, so it
    // contributes no gap rather than an assumed one.
    if (!event || !benchmark) {
      return [];
    }

    const result = latest.get(eventId);
    if (!result) {
      return [{ eventId, current: null, benchmark: benchmark.target, gap: null, met: false }];
    }

    // Direction is the event's own property. Assuming "bigger is better" here
    // would report every swim time as a triumph.
    const met =
      event.direction === 'lower_is_better'
        ? result.value <= benchmark.target
        : result.value >= benchmark.target;

    return [
      {
        eventId,
        current: result.value,
        benchmark: benchmark.target,
        gap: met ? 0 : Math.abs(benchmark.target - result.value),
        met,
      },
    ];
  });
}

function stepFor(
  domain: TargetDomain,
  target: TargetDefinition,
  readiness: TargetReadiness | null,
  results: readonly AssessmentResult[],
): RoadStep {
  const events = eventGaps(domain, target, results);
  const score = readiness?.domains[domain.id] ?? null;

  if (score === null) {
    // No score, and no way to get one: strength on a Target with no safe
    // assessment lands here. Saying so beats silently dropping the domain,
    // which would read as though it did not matter.
    //
    // Behavioural domains are always measurable -- their input is the athlete's
    // own training history, so the route to a score is to train, not to test.
    const measurable =
      preparationDomain(domain.id).measurement === 'behavioural' ||
      domain.eventIds.length > 0 ||
      (domain.proficiencySkills?.length ?? 0) > 0;
    return {
      domainId: domain.id,
      kind: measurable ? 'measure' : 'unavailable',
      score: null,
      weight: domain.weight,
      // An unmeasured domain carries its full headroom, so it outranks any
      // measured domain of the same weight. You cannot train what you have
      // not located.
      impact: measurable ? domain.weight * DOMAIN_TARGET_SCORE : 0,
      events,
    };
  }

  const headroom = Math.max(0, DOMAIN_TARGET_SCORE - score);

  return {
    domainId: domain.id,
    kind: headroom === 0 ? 'maintain' : 'improve',
    score,
    weight: domain.weight,
    impact: domain.weight * headroom,
    events,
  };
}

export function buildRoadToReady(
  target: TargetDefinition,
  readiness: TargetReadiness | null,
  results: readonly AssessmentResult[],
): RoadToReady {
  const steps = target.domains.map((domain) => stepFor(domain, target, readiness, results));

  // Stable sort on impact. The index tiebreak keeps the Target's declared
  // order, so the list does not reshuffle between renders.
  const ordered = steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => b.step.impact - a.step.impact || a.index - b.index)
    .map(({ step }) => step);

  const unmeasuredWeight = steps
    .filter((step) => step.kind === 'measure')
    .reduce((sum, step) => sum + step.weight, 0);

  const focus = ordered.find((step) => step.impact > 0) ?? null;

  return {
    steps: ordered,
    atBenchmark: steps.filter((step) => step.kind === 'maintain').length,
    unmeasuredWeight,
    focus,
  };
}
