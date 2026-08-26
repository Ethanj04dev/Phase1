import type { AssessmentEventId } from '@/domain/assessment/types';
import type { ServiceBranch } from '@/domain/goals/types';

import type { DemandLevel, PreparationDomainId, ProficiencyLevel } from './domains';
import type { Source, Verified } from './provenance';

/**
 * A Target is what the athlete is preparing for.
 *
 * It owns everything that differs between careers: which domains are scored,
 * what the standards are, what the pipeline looks like, what to study. Adding
 * a career should mean writing a definition, not editing the application.
 */

export type TargetId = string;

// --- Standards --------------------------------------------------------------
//
// OfficialStandard and Phase1Benchmark are separate types with different field
// names on purpose. One cannot be passed where the other is expected, so a
// Phase 1 recommendation cannot reach a screen that labels it official, and no
// amount of later refactoring can quietly merge them.

/** A documented military requirement. Never authored by Phase 1. */
export interface OfficialStandard {
  eventId: AssessmentEventId;
  /**
   * Absent until sourced. There is no placeholder number, because a
   * placeholder that looks official is worse than an empty field.
   */
  requirement: Verified<StandardRequirement>;
  /** What the standard is for, e.g. a specific entry test. */
  context?: string;
}

export interface StandardRequirement {
  /** Repetitions or seconds, per the event unit. */
  value: number;
  /** Qualifier as published, e.g. "minimum to qualify". */
  qualifier?: string;
}

/**
 * A preparation benchmark authored by Phase 1.
 *
 * Explicitly not a requirement. It is where Phase 1 thinks an athlete should
 * be to arrive prepared rather than merely eligible, and it says so.
 */
export interface Phase1Benchmark {
  eventId: AssessmentEventId;
  /** Repetitions or seconds, per the event unit. */
  target: number;
  /** Why Phase 1 picked this figure. Shown to the athlete on request. */
  rationale: string;
}

// --- Domains ----------------------------------------------------------------

export interface TargetDomain {
  id: PreparationDomainId;
  /** Share of the readiness score. Weights across a Target sum to 1. */
  weight: number;
  /** How hard this Target leans on the domain, for Physical Demands. */
  demand: DemandLevel;
  /** Why this domain matters for *this* Target specifically. */
  rationale: string;
  /**
   * Events that score this domain. Empty is legitimate: a domain with no safe
   * or available assessment carries no score and says so, rather than being
   * given an invented one.
   */
  eventIds: readonly AssessmentEventId[];
  /** Proficiency domains are self-assessed against these named skills. */
  proficiencySkills?: readonly ProficiencySkill[];
}

export interface ProficiencySkill {
  id: string;
  label: string;
  description: string;
  /** Level Phase 1 suggests aiming for. Not an official requirement. */
  phase1Target: ProficiencyLevel;
  /**
   * True where the skill must not be practised alone. Surfaced on the session
   * itself, never buried in a settings screen.
   */
  requiresSupervision: boolean;
  safetyNotice?: string;
}

// --- Pipeline ---------------------------------------------------------------

export interface PipelineStage {
  id: string;
  name: string;
  summary: string;
  location?: Verified<string>;
  /** Weeks. Unverified until sourced. */
  durationWeeks?: Verified<number>;
  /** Domains this stage leans on hardest. */
  emphasis: readonly PreparationDomainId[];
  /** What a candidate should understand before arriving. */
  whatToKnow?: string;
}

// --- Milestones -------------------------------------------------------------

/**
 * Steps in the athlete's own preparation journey.
 *
 * Personal admin, not official process guidance. Different candidates follow
 * different routes, so these are configurable and none is presented as
 * required.
 */
export interface MilestoneDefinition {
  id: string;
  label: string;
  description: string;
  /** Suggested order. Athletes may complete them out of sequence. */
  order: number;
}

// --- Career intel -----------------------------------------------------------

export type IntelCategory =
  | 'mission'
  | 'role'
  | 'pipeline'
  | 'fitness'
  | 'assessments'
  | 'preparation'
  | 'faq'
  | 'terminology';

export interface IntelArticle {
  id: string;
  category: IntelCategory;
  title: string;
  /** Paragraphs. Rendered as prose, not as a wall of bullet points. */
  body: readonly string[];
  /** Present only where the content states something as fact about the career. */
  sourceIds?: readonly string[];
}

// --- Assessments ------------------------------------------------------------

export interface TargetAssessment {
  eventId: AssessmentEventId;
  /**
   * Whether this test exists because the military runs it, or because Phase 1
   * uses it to measure preparation. The athlete is always told which.
   */
  origin: 'official' | 'phase1';
  /** Domain this assessment scores. */
  domainId: PreparationDomainId;
}

// --- The definition ---------------------------------------------------------

export interface TargetDefinition {
  id: TargetId;
  name: string;
  /** Compact form for dense headers, e.g. "PJ". */
  shortName: string;
  branch: ServiceBranch;
  /** The umbrella the career sits under, e.g. "Air Force Special Warfare". */
  category: string;
  description: string;
  /** Scored domains and their weights. */
  domains: readonly TargetDomain[];
  officialStandards: readonly OfficialStandard[];
  phase1Benchmarks: readonly Phase1Benchmark[];
  assessments: readonly TargetAssessment[];
  pipeline: readonly PipelineStage[];
  milestones: readonly MilestoneDefinition[];
  intel: readonly IntelArticle[];
  sources: readonly Source[];
}

/** Weights across a Target must describe a full distribution. */
export function domainWeightsSumToOne(
  target: TargetDefinition,
  tolerance = 1e-6,
): boolean {
  const total = target.domains.reduce((sum, domain) => sum + domain.weight, 0);
  return Math.abs(total - 1) <= tolerance;
}

export function findDomain(
  target: TargetDefinition,
  domainId: PreparationDomainId,
): TargetDomain | undefined {
  return target.domains.find((domain) => domain.id === domainId);
}

export function phase1BenchmarkFor(
  target: TargetDefinition,
  eventId: AssessmentEventId,
): Phase1Benchmark | undefined {
  return target.phase1Benchmarks.find((benchmark) => benchmark.eventId === eventId);
}

export function officialStandardFor(
  target: TargetDefinition,
  eventId: AssessmentEventId,
): OfficialStandard | undefined {
  return target.officialStandards.find((standard) => standard.eventId === eventId);
}
