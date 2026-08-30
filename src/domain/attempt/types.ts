import type { AssessmentEventId } from '@/domain/assessment/types';
import type { GoalId } from '@/domain/goals/types';
import type { IsoDateTime, Uuid } from '@/domain/types';

import type { AssessmentDefinition } from './definition';

/**
 * A complete assessment attempt: the competitive object.
 *
 * The foundational rule of the product lives in this module: official ratings
 * and rankings come from complete assessment attempts, never from a
 * collection of best individual results recorded on different days. A
 * performance assembled from cherry-picked events never actually occurred,
 * and a leaderboard built on performances that never occurred is not worth
 * ranking on.
 *
 * Individual event results (AssessmentResult) remain, as training data:
 * personal records, weakness analysis, progress charts. They are never
 * leaderboard-eligible.
 */

export type AttemptStatus = 'completed' | 'incomplete' | 'aborted' | 'failed';

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  completed: 'Completed',
  incomplete: 'Incomplete',
  aborted: 'Aborted',
  failed: 'Failed',
};

/**
 * Where an attempt sits on the trust ladder. Only the server ever moves an
 * attempt past 'self_reported'; the client can submit claims and evidence,
 * never verdicts.
 */
export type VerificationStatus =
  | 'self_reported'
  | 'pending_review'
  | 'zero_verified'
  | 'proctored'
  | 'rejected';

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  self_reported: 'Self-reported',
  pending_review: 'Pending review',
  zero_verified: 'Verified',
  proctored: 'Proctored',
  rejected: 'Rejected',
};

/**
 * How verification was (or will be) performed. Most of these are future
 * methods; the union exists now so the data model never has to change shape
 * when they arrive.
 */
export type VerificationMethod =
  | 'self_reported'
  | 'video_review'
  | 'sensor_data'
  | 'device_integration'
  | 'community_review'
  | 'approved_proctor'
  | 'trusted_organization'
  | 'automated_review';

/** One event result inside an attempt. Belongs to the attempt, not to a day. */
export interface AttemptEventResult {
  eventId: AssessmentEventId;
  /** Reps, or seconds, per the event unit. */
  value: number;
  /** Position in the sequence as performed, 0-based. */
  order: number;
}

export interface AssessmentAttempt {
  id: Uuid;
  athleteId: Uuid;
  /** The protocol this attempt was performed under. */
  definitionId: string;
  definitionVersion: number;
  pipelineId: GoalId;
  status: AttemptStatus;
  /** When the assessment was performed. Self-stated for practice attempts. */
  occurredAt: IsoDateTime;
  startedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  /** Verification lifecycle timestamps. All null until verification exists. */
  submittedAt: IsoDateTime | null;
  verifiedAt: IsoDateTime | null;
  verificationStatus: VerificationStatus;
  verificationMethod: VerificationMethod;
  results: readonly AttemptEventResult[];
  /**
   * Client-computed preview from a complete attempt, 0–1000. Clearly labelled
   * estimated everywhere it renders; never ranks anything.
   */
  estimatedRating: number | null;
  /** Scoring config version the estimate was computed under. */
  scoringConfigVersion: number | null;
  /**
   * Server-issued only. The client never writes this field, and the database
   * refuses inserts that carry it. Null means "no official rating exists",
   * which is every attempt until verification lands in M3.
   */
  officialRating: number | null;
  notes: string | null;
  createdAt: IsoDateTime;
}

/**
 * Statuses that can ever hold an official rating and enter a leaderboard.
 * Self-reported is deliberately absent and always will be.
 */
export const RANKABLE_VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'zero_verified',
  'proctored',
];

/**
 * The one gate rankings pass through. An attempt is leaderboard-eligible only
 * when it is a complete performance, verified by the server, with a
 * server-issued rating. Which eligible attempt a leaderboard actually uses
 * (most recent, best within a window) is a separate, configurable policy —
 * but it always selects from attempts that pass this test.
 */
export function isLeaderboardEligible(attempt: AssessmentAttempt): boolean {
  return (
    attempt.status === 'completed' &&
    RANKABLE_VERIFICATION_STATUSES.includes(attempt.verificationStatus) &&
    attempt.officialRating !== null
  );
}

/**
 * Whether a set of entered results completes the definition.
 *
 * 'all_events' is the only rule so far: every event in the protocol has a
 * result. Encoded here rather than in a screen so the form, the save path
 * and the scoring engine cannot disagree about what "complete" means.
 */
export function isAttemptComplete(
  definition: AssessmentDefinition,
  results: readonly AttemptEventResult[],
): boolean {
  switch (definition.completionRule) {
    case 'all_events': {
      const entered = new Set(results.map((result) => result.eventId));
      return definition.events.every((event) => entered.has(event.eventId));
    }
  }
}

/**
 * Attempts newest-first by when they were performed, ties broken by when
 * they were logged — two practice attempts on the same date order stably.
 */
export function sortAttemptsByOccurrence(
  attempts: readonly AssessmentAttempt[],
): AssessmentAttempt[] {
  return [...attempts].sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt),
  );
}
