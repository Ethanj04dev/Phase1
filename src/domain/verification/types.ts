import type { AssessmentEventId } from '@/domain/assessment/types';
import type { IsoDateTime, Uuid } from '@/domain/types';

/**
 * Verification: the three-outcome model and the session shapes.
 *
 * The database is the authority for all of this — every status transition
 * happens inside SECURITY DEFINER functions with the server's clock. These
 * types mirror those tables for display, and the one pure function here
 * (composeAssessmentVerdict) mirrors the SQL composition rule so the UI can
 * explain a verdict without asking the server to re-derive it.
 */

/**
 * Every event and every assessment resolves to one of three outcomes.
 * The system is never forced to guess: insufficient evidence or confidence
 * is 'unable_to_verify', never a rounded-up 'verified' and never an accusing
 * 'failed'. FAILED requires positive evidence of invalidity.
 */
export type VerificationVerdict = 'verified' | 'failed' | 'unable_to_verify';

export const VERDICT_LABELS: Record<VerificationVerdict, string> = {
  verified: 'Verified',
  failed: 'Failed',
  unable_to_verify: 'Unable to verify',
};

export type SessionStatus =
  | 'issued'
  | 'active'
  | 'submitted'
  | 'interrupted'
  | 'expired'
  | 'abandoned';

export interface VerificationSession {
  id: Uuid;
  definitionId: string;
  definitionVersion: number;
  pipelineId: string;
  /** Protocol event order, fixed at creation and enforced by the server. */
  eventOrder: readonly AssessmentEventId[];
  challengeCode: string;
  challengeExpiresAt: IsoDateTime;
  status: SessionStatus;
  /** The currently open event, if any. */
  openEvent: AssessmentEventId | null;
  attemptId: Uuid | null;
  createdAt: IsoDateTime;
  startedAt: IsoDateTime | null;
}

export interface SessionEventClaim {
  eventId: AssessmentEventId;
  claimedValue: number;
  order: number;
  openedAt: IsoDateTime;
  closedAt: IsoDateTime;
}

export type TimelineEntryType =
  | 'session_created'
  | 'identity_committed'
  | 'event_open'
  | 'event_close'
  | 'evidence_committed'
  | 'submitted'
  | 'interrupted'
  | 'abandoned';

export interface TimelineEntry {
  id: Uuid;
  entryType: TimelineEntryType;
  eventId: AssessmentEventId | null;
  serverTime: IsoDateTime;
}

/**
 * The composition rule, verbatim from finalize_verification_attempt():
 * all verified → verified; any failed → failed; otherwise unable_to_verify.
 * An empty list composes to unable_to_verify — no events is not a pass.
 */
export function composeAssessmentVerdict(
  eventVerdicts: readonly VerificationVerdict[],
): VerificationVerdict {
  if (eventVerdicts.length === 0) {
    return 'unable_to_verify';
  }
  if (eventVerdicts.some((verdict) => verdict === 'failed')) {
    return 'failed';
  }
  if (eventVerdicts.every((verdict) => verdict === 'verified')) {
    return 'verified';
  }
  return 'unable_to_verify';
}

/**
 * Reason codes the integrity engine emits, with the human-readable line the
 * UI shows for each. Machine codes never reach the screen raw.
 */
export const INTEGRITY_REASON_LABELS: Record<string, string> = {
  identity_clip_missing: 'The identity clip was missing or never finished uploading.',
  evidence_missing: 'No evidence was captured for this event.',
  evidence_not_uploaded: 'The recording for this event never finished uploading.',
  duration_window_mismatch:
    'The recording does not span the time the event was actually open.',
  hash_outside_window: 'The recording was not captured during the event window.',
  transition_budget_exceeded: 'The rest before this event exceeded the allowed transition time.',
  evidence_reused: 'This recording has already been used for another assessment.',
  unable_to_verify: 'The evidence could not be reliably evaluated.',
};

export function integrityReasonLabel(code: string): string {
  return INTEGRITY_REASON_LABELS[code] ?? 'The evidence did not pass integrity checks.';
}

/** A session that can still be continued after an interruption or relaunch. */
export function isSessionResumable(session: VerificationSession, nowIso: string): boolean {
  return (
    (session.status === 'issued' || session.status === 'active') &&
    session.challengeExpiresAt > nowIso
  );
}
