import type { AssessmentEventId } from '@/domain/assessment/types';
import type { GoalId } from '@/domain/goals/types';

/**
 * An assessment definition: the protocol, not the performance.
 *
 * A standardised selection test is a complete sequence performed under defined
 * conditions — event order, transitions, time limits. It is not a shopping
 * list of exercises, which is why these rules live in a versioned definition
 * rather than hard-coded into screens: when an official standard changes, a
 * new version is added and historical attempts keep pointing at the protocol
 * they were actually performed under.
 *
 * Definitions ship with the app like pipelines do. The catalog is in
 * `src/data/content/assessments`.
 */

/** One event inside an assessment, in sequence. */
export interface AssessmentEventSpec {
  eventId: AssessmentEventId;
  /**
   * Prescribed rest before the next event, in seconds. Null means the
   * protocol source does not specify one (or it is not yet sourced) — which
   * is different from zero, and the UI must not print an invented number.
   */
  transitionRestSeconds: number | null;
  /** Event-specific protocol notes beyond the event's own standard protocol. */
  notes?: string;
}

/**
 * When an attempt counts as complete. A closed union that grows as real
 * protocols demand it (e.g. pass/fail gates per event).
 */
export type CompletionRule = 'all_events';

export interface AssessmentDefinition {
  /** Stable id, e.g. 'pj_ift'. Never reused across meanings. */
  id: string;
  /**
   * Protocol version. Bumped when the event set, order, or rules change.
   * Attempts stamp the version they were performed under, so a rule change
   * can never silently rewrite history.
   */
  version: number;
  pipelineId: GoalId;
  name: string;
  /** Compact label for dense headers, e.g. "IFT". */
  shortName: string;
  /** The full sequence, in prescribed order. */
  events: readonly AssessmentEventSpec[];
  completionRule: CompletionRule;
  /**
   * Protocol statements shown to the athlete. Sourcing discipline matches
   * official standards elsewhere: provisional wording says so plainly.
   */
  protocolNotes: readonly string[];
  /**
   * Honesty marker. Definitions start as provisional practice protocols
   * modelled on the official test; 'sourced' is only set once the protocol
   * is backed by an authoritative document.
   */
  provenance: 'provisional' | 'sourced';
}

export function definitionEventIds(
  definition: AssessmentDefinition,
): readonly AssessmentEventId[] {
  return definition.events.map((event) => event.eventId);
}
