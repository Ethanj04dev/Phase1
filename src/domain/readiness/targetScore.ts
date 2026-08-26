import {
  findAssessmentEvent,
  latestResultByEvent,
  type AssessmentResult,
} from '@/domain/assessment/types';
import {
  PROFICIENCY_LEVEL_SCORES,
  preparationDomain,
  type PreparationDomainId,
  type ProficiencyLevel,
} from '@/domain/target/domains';
import type { TargetDefinition, TargetDomain } from '@/domain/target/types';

import { BENCHMARK_VERSION } from './benchmarks';
import { scoreEvent } from './score';
import { READINESS_MAX, READINESS_MIN } from './types';

/**
 * Target-aware readiness.
 *
 * The previous engine scored a fixed set of four categories for everyone. This
 * one scores whatever domains the athlete's Target defines, which is what lets
 * a Ranger candidate never be scored on swimming and a PJ candidate be scored
 * on water confidence.
 *
 * Still pure and deterministic: no clock, no ids, no randomness. Behavioural
 * domains are passed in rather than computed here, because the history they
 * derive from lives in the repository layer and dragging it in would make this
 * untestable.
 */

export type DomainScores = Partial<Record<PreparationDomainId, number>>;

export interface ReadinessInput {
  results: readonly AssessmentResult[];
  /** Self-assessed proficiency, keyed by skill id. */
  proficiency?: Readonly<Record<string, ProficiencyLevel>>;
  /**
   * Scores for behavioural domains, 0-100, supplied by the caller that holds
   * the training history. Absent means the domain is not yet measurable.
   */
  behavioural?: DomainScores;
}

export interface TargetReadiness {
  overall: number;
  domains: DomainScores;
  strongestDomain: PreparationDomainId | null;
  /**
   * Where improvement buys the most overall score. Weighted headroom, not raw
   * weakness: a weak domain that barely matters to this Target is not the
   * priority.
   */
  priorityDomain: PreparationDomainId | null;
  /** Share of the Target's weighted profile backed by real data, 0-1. */
  coverage: number;
  benchmarkVersion: number;
}

function clampScore(score: number): number {
  return Math.min(READINESS_MAX, Math.max(READINESS_MIN, score));
}

/**
 * Scores one domain, or returns null when there is nothing to score it from.
 *
 * Null is not zero. A domain with no data is unmeasured; scoring it zero would
 * tell an athlete they failed a test they never took.
 */
export function scoreDomain(
  domain: TargetDomain,
  input: ReadinessInput,
): number | null {
  const measurement = preparationDomain(domain.id).measurement;

  if (measurement === 'behavioural') {
    const score = input.behavioural?.[domain.id];
    return score === undefined ? null : Math.round(clampScore(score));
  }

  if (measurement === 'proficiency') {
    const skills = domain.proficiencySkills ?? [];
    const recorded = skills.flatMap((skill) => {
      const level = input.proficiency?.[skill.id];
      return level === undefined ? [] : [PROFICIENCY_LEVEL_SCORES[level]];
    });
    if (recorded.length === 0) {
      return null;
    }
    const total = recorded.reduce((sum, score) => sum + score, 0);
    return Math.round(clampScore(total / recorded.length));
  }

  // Performance: the athlete's latest result for each event the domain scores.
  const latest = latestResultByEvent(input.results);
  const scores = domain.eventIds.flatMap((eventId) => {
    const result = latest.get(eventId);
    if (!result || !findAssessmentEvent(eventId)) {
      return [];
    }
    return [scoreEvent(eventId, result.value)];
  });

  if (scores.length === 0) {
    return null;
  }
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(clampScore(total / scores.length));
}

/**
 * Computes readiness against a Target.
 *
 * Weights are renormalised across the domains that actually have data, so an
 * athlete who has not tested their swim is not punished with an implicit zero.
 * Coverage reports how much of their weighted profile is known.
 */
export function calculateTargetReadiness(
  target: TargetDefinition,
  input: ReadinessInput,
): TargetReadiness | null {
  const domains: DomainScores = {};
  let weightedTotal = 0;
  let coveredWeight = 0;

  // Iterating the Target's own order keeps ties deterministic.
  for (const domain of target.domains) {
    const score = scoreDomain(domain, input);
    if (score === null) {
      continue;
    }
    domains[domain.id] = score;
    weightedTotal += score * domain.weight;
    coveredWeight += domain.weight;
  }

  if (coveredWeight <= 0) {
    return null;
  }

  let strongestDomain: PreparationDomainId | null = null;
  let strongestScore = -1;
  let priorityDomain: PreparationDomainId | null = null;
  let bestHeadroom = -1;

  for (const domain of target.domains) {
    const score = domains[domain.id];
    if (score === undefined) {
      continue;
    }
    if (score > strongestScore) {
      strongestScore = score;
      strongestDomain = domain.id;
    }
    const headroom = domain.weight * (READINESS_MAX - score);
    if (headroom > bestHeadroom) {
      bestHeadroom = headroom;
      priorityDomain = domain.id;
    }
  }

  return {
    overall: Math.round(clampScore(weightedTotal / coveredWeight)),
    domains,
    strongestDomain,
    priorityDomain,
    // Weights sum to 1, so covered weight is already a fraction.
    coverage: Math.min(1, coveredWeight),
    benchmarkVersion: BENCHMARK_VERSION,
  };
}
