import type { SupabaseClient } from '@supabase/supabase-js';

import type { AssessmentEventId } from '@/domain/assessment/types';
import type {
  SessionEventClaim,
  SessionStatus,
  TimelineEntry,
  TimelineEntryType,
  VerificationSession,
  VerificationVerdict,
} from '@/domain/verification/types';
import { err, ok, type DomainError, type Result } from '@/domain/types';

import type {
  ReviewDetail,
  ReviewEventState,
  VerificationRepository,
} from '@/data/repositories/types';

import { friendlyMessage } from './client';

/**
 * The client half of the verification server.
 *
 * Every state change is an RPC into a SECURITY DEFINER function — this file
 * holds no authority. It cannot: the database functions re-derive the caller
 * from auth.uid(), stamp their own clock, and validate every transition
 * against server state. What lives here is translation and the storage
 * upload.
 */

function failure(fallback: string, cause: unknown): Result<never> {
  const error: DomainError = {
    code: 'network',
    message: friendlyMessage(fallback, cause),
    cause,
  };
  return err(error);
}

/** Known server exceptions mapped to sentences a candidate can act on. */
const SERVER_ERRORS: Record<string, string> = {
  session_already_active: 'You already have an assessment session in progress.',
  session_expired: 'This session has expired. Start a new assessment.',
  session_not_found: 'We could not find that session.',
  session_not_active: 'This session is not active.',
  event_not_open: 'This event is not open right now.',
  event_already_open: 'Close the current event before opening another.',
  event_out_of_order: 'Events must be performed in protocol order.',
  events_missing: 'Every event needs a result before submitting.',
  event_still_open: 'Close the current event before submitting.',
  evidence_reused: 'This recording has already been used. Record a fresh one.',
  no_evidence_committed: 'Record the event before closing it.',
  identity_already_committed: 'Identity is already confirmed for this session.',
  not_a_reviewer: 'Your account does not have review access.',
  cannot_review_own_attempt: 'You cannot review your own assessment.',
  accepted_value_required: 'Enter the accepted value for a verified event.',
  reason_required: 'A reason is required for this verdict.',
  no_athlete_profile: 'Complete onboarding before taking a verified assessment.',
};

function rpcFailure(fallback: string, cause: unknown): Result<never> {
  const message =
    typeof cause === 'object' && cause !== null && 'message' in cause
      ? String((cause as { message: unknown }).message)
      : '';
  for (const [code, friendly] of Object.entries(SERVER_ERRORS)) {
    if (message.includes(code)) {
      return err({ code: 'validation', message: friendly, cause });
    }
  }
  return failure(fallback, cause);
}

interface SessionRow {
  id: string;
  definition_id: string;
  definition_version: number;
  pipeline_id: string;
  event_order: string[];
  challenge_code: string;
  challenge_expires_at: string;
  status: string;
  open_event: string | null;
  attempt_id: string | null;
  created_at: string;
  started_at: string | null;
}

function toSession(row: SessionRow): VerificationSession {
  return {
    id: row.id,
    definitionId: row.definition_id,
    definitionVersion: row.definition_version,
    pipelineId: row.pipeline_id,
    eventOrder: row.event_order as AssessmentEventId[],
    challengeCode: row.challenge_code,
    challengeExpiresAt: row.challenge_expires_at,
    status: row.status as SessionStatus,
    openEvent: (row.open_event as AssessmentEventId | null) ?? null,
    attemptId: row.attempt_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
  };
}

interface ClaimRow {
  event_id: string;
  claimed_value: number;
  event_order: number;
  opened_at: string;
  closed_at: string;
}

function toClaim(row: ClaimRow): SessionEventClaim {
  return {
    eventId: row.event_id as AssessmentEventId,
    claimedValue: Number(row.claimed_value),
    order: row.event_order,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

export function createVerificationRepository(client: SupabaseClient): VerificationRepository {
  return {
    getActiveSession: async () => {
      const { data, error } = await client
        .from('verification_sessions')
        .select('*')
        .in('status', ['issued', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        return failure('We could not check for an active session.', error);
      }
      return ok(data ? toSession(data as SessionRow) : null);
    },

    createSession: async (definitionId, definitionVersion, pipelineId, eventOrder) => {
      const { data, error } = await client.rpc('create_verification_session', {
        p_definition_id: definitionId,
        p_definition_version: definitionVersion,
        p_pipeline_id: pipelineId,
        p_event_order: eventOrder,
        p_device_metadata: {},
      });
      if (error) {
        return rpcFailure('We could not start a verified session.', error);
      }
      return ok(toSession(data as SessionRow));
    },

    commitEvidence: async (
      sessionId,
      eventId,
      kind,
      contentHash,
      clientCapturedAt,
      durationSeconds,
      byteSize,
      mimeType,
    ) => {
      const { data, error } = await client.rpc('commit_evidence', {
        p_session_id: sessionId,
        p_event_id: eventId,
        p_kind: kind,
        p_content_hash: contentHash,
        p_client_captured_at: clientCapturedAt,
        p_duration_seconds: durationSeconds,
        p_byte_size: byteSize,
        p_mime_type: mimeType,
      });
      if (error) {
        return rpcFailure('We could not register the recording.', error);
      }
      return ok({ evidenceId: (data as { id: string }).id });
    },

    uploadEvidence: async (evidenceId, sessionId, localUri, mimeType) => {
      // The path is prefixed by athlete id, which the storage policy checks.
      const profile = await client
        .from('athlete_profiles')
        .select('id')
        .maybeSingle();
      if (profile.error || !profile.data) {
        return failure('We could not find your profile for the upload.', profile.error);
      }
      const path = `${(profile.data as { id: string }).id}/${sessionId}/${evidenceId}`;

      const response = await fetch(localUri);
      const body = await response.blob();

      const uploaded = await client.storage.from('evidence').upload(path, body, {
        contentType: mimeType,
        upsert: false,
      });
      if (uploaded.error) {
        return failure('The recording could not be uploaded.', uploaded.error);
      }

      const registered = await client.rpc('register_evidence_upload', {
        p_evidence_id: evidenceId,
        p_storage_path: path,
      });
      if (registered.error) {
        return rpcFailure('The upload could not be registered.', registered.error);
      }
      return ok(undefined);
    },

    openEvent: async (sessionId, eventId) => {
      const { error } = await client.rpc('open_session_event', {
        p_session_id: sessionId,
        p_event_id: eventId,
      });
      return error ? rpcFailure('We could not open the event.', error) : ok(undefined);
    },

    closeEvent: async (sessionId, eventId, claimedValue) => {
      const { error } = await client.rpc('close_session_event', {
        p_session_id: sessionId,
        p_event_id: eventId,
        p_claimed_value: claimedValue,
      });
      return error ? rpcFailure('We could not record the result.', error) : ok(undefined);
    },

    submit: async (sessionId) => {
      const { data, error } = await client.rpc('submit_verification_session', {
        p_session_id: sessionId,
      });
      if (error) {
        return rpcFailure('We could not submit the assessment.', error);
      }
      return ok(data as string);
    },

    abandon: async (sessionId) => {
      const { error } = await client.rpc('abandon_verification_session', {
        p_session_id: sessionId,
      });
      return error ? rpcFailure('We could not abandon the session.', error) : ok(undefined);
    },

    getClaims: async (sessionId) => {
      const { data, error } = await client
        .from('session_event_claims')
        .select('*')
        .eq('session_id', sessionId)
        .order('event_order');
      if (error) {
        return failure('We could not load the session results.', error);
      }
      return ok((data as ClaimRow[]).map(toClaim));
    },

    recordShadowAnalysis: async (attemptId, eventId, analysis) => {
      const { error } = await client.rpc('record_shadow_analysis', {
        p_attempt_id: attemptId,
        p_event_id: eventId,
        p_engine: analysis.engine,
        p_model_name: analysis.modelName,
        p_model_version: analysis.modelVersion,
        p_ruleset_version: analysis.rulesetVersion,
        p_claimed_value: analysis.claimedValue,
        p_detected_value: analysis.detectedValue,
        p_accepted_value: analysis.acceptedValue,
        p_verdict: analysis.verdict,
        p_confidences: analysis.confidences,
        p_reason_codes: analysis.reasonCodes,
        p_metrics: analysis.metrics,
      });
      return error ? rpcFailure('The analysis could not be recorded.', error) : ok(undefined);
    },

    // --- Console -------------------------------------------------------------

    isReviewer: async () => {
      const { data, error } = await client.from('reviewers').select('active').maybeSingle();
      if (error) {
        return failure('We could not check review access.', error);
      }
      return ok(Boolean((data as { active?: boolean } | null)?.active));
    },

    listReviewQueue: async () => {
      const { data, error } = await client
        .from('assessment_attempts')
        .select('id, definition_id, definition_version, pipeline_id, submitted_at')
        .eq('verification_status', 'pending_review')
        .order('submitted_at', { ascending: true });
      if (error) {
        return failure('We could not load the review queue.', error);
      }
      return ok(
        (data as {
          id: string;
          definition_id: string;
          definition_version: number;
          pipeline_id: string;
          submitted_at: string | null;
        }[]).map((row) => ({
          attemptId: row.id,
          definitionId: row.definition_id,
          definitionVersion: row.definition_version,
          pipelineId: row.pipeline_id,
          submittedAt: row.submitted_at,
        })),
      );
    },

    getReviewDetail: async (attemptId) => {
      const attempt = await client
        .from('assessment_attempts')
        .select('id, definition_id, definition_version, verification_status, submitted_at')
        .eq('id', attemptId)
        .maybeSingle();
      if (attempt.error || !attempt.data) {
        return failure('We could not load that attempt.', attempt.error);
      }
      const attemptRow = attempt.data as {
        id: string;
        definition_id: string;
        definition_version: number;
        verification_status: string;
        submitted_at: string | null;
      };

      const session = await client
        .from('verification_sessions')
        .select('*')
        .eq('attempt_id', attemptId)
        .maybeSingle();
      const sessionRow = (session.data as SessionRow | null) ?? null;

      const [timeline, claims, evidence, results, reviews, analysis, shadow] =
        await Promise.all([
        sessionRow
          ? client
              .from('session_timeline_entries')
              .select('id, entry_type, event_id, server_time')
              .eq('session_id', sessionRow.id)
              .order('server_time')
          : Promise.resolve({ data: [], error: null }),
        sessionRow
          ? client
              .from('session_event_claims')
              .select('*')
              .eq('session_id', sessionRow.id)
              .order('event_order')
          : Promise.resolve({ data: [], error: null }),
        sessionRow
          ? client
              .from('evidence')
              .select('id, event_id, kind, storage_path, duration_seconds, received_at')
              .eq('session_id', sessionRow.id)
          : Promise.resolve({ data: [], error: null }),
        client
          .from('attempt_event_results')
          .select('event_id, value, event_order')
          .eq('attempt_id', attemptId)
          .order('event_order'),
        client
          .from('verification_event_reviews')
          .select('event_id, verdict, accepted_value, reason_code')
          .eq('attempt_id', attemptId)
          .eq('authoritative', true),
        client
          .from('analysis_events')
          .select('event_id, verdict, reason_codes, analysis_runs!inner(attempt_id)')
          .eq('engine', 'evidence_integrity')
          .eq('analysis_runs.attempt_id', attemptId),
        client
          .from('analysis_events')
          .select(
            'event_id, engine, model_version, ruleset_version, verdict, detected_value, accepted_value, reason_codes, confidences, metrics, analysis_runs!inner(attempt_id, trigger)',
          )
          .neq('engine', 'evidence_integrity')
          .eq('analysis_runs.attempt_id', attemptId)
          .eq('analysis_runs.trigger', 'shadow'),
      ]);

      const reviewByEvent = new Map(
        ((reviews.data ?? []) as {
          event_id: string;
          verdict: string;
          accepted_value: number | null;
          reason_code: string | null;
        }[]).map((row) => [row.event_id, row]),
      );

      const events: ReviewEventState[] = (
        (results.data ?? []) as { event_id: string; value: number }[]
      ).map((row) => {
        const review = reviewByEvent.get(row.event_id);
        return {
          eventId: row.event_id as AssessmentEventId,
          claimedValue: Number(row.value),
          reviewVerdict: (review?.verdict as VerificationVerdict | undefined) ?? null,
          acceptedValue: review?.accepted_value == null ? null : Number(review.accepted_value),
          reasonCode: review?.reason_code ?? null,
        };
      });

      const detail: ReviewDetail = {
        attemptId: attemptRow.id,
        definitionId: attemptRow.definition_id,
        definitionVersion: attemptRow.definition_version,
        verificationStatus: attemptRow.verification_status,
        submittedAt: attemptRow.submitted_at,
        session: sessionRow ? toSession(sessionRow) : null,
        timeline: ((timeline.data ?? []) as {
          id: string;
          entry_type: string;
          event_id: string | null;
          server_time: string;
        }[]).map((row) => ({
          id: row.id,
          entryType: row.entry_type as TimelineEntryType,
          eventId: (row.event_id as AssessmentEventId | null) ?? null,
          serverTime: row.server_time,
        })) as TimelineEntry[],
        claims: ((claims.data ?? []) as ClaimRow[]).map(toClaim),
        evidence: ((evidence.data ?? []) as {
          id: string;
          event_id: string | null;
          kind: string;
          storage_path: string | null;
          duration_seconds: number | null;
          received_at: string | null;
        }[]).map((row) => ({
          id: row.id,
          eventId: (row.event_id as AssessmentEventId | null) ?? null,
          kind: row.kind as 'video' | 'gps_trace',
          storagePath: row.storage_path,
          durationSeconds:
            row.duration_seconds == null ? null : Number(row.duration_seconds),
          receivedAt: row.received_at,
        })),
        integrity: ((analysis.data ?? []) as {
          event_id: string | null;
          verdict: string;
          reason_codes: string[];
        }[]).map((row) => ({
          eventId: (row.event_id as AssessmentEventId | null) ?? null,
          verdict: row.verdict as VerificationVerdict | 'uncertain',
          reasonCodes: row.reason_codes ?? [],
        })),
        shadow: ((shadow.data ?? []) as {
          event_id: string | null;
          engine: string;
          model_version: string;
          ruleset_version: number;
          verdict: string;
          detected_value: number | null;
          accepted_value: number | null;
          reason_codes: string[];
          confidences: Record<string, number>;
          metrics: Record<string, unknown>;
        }[]).map((row) => ({
          eventId: (row.event_id as AssessmentEventId | null) ?? null,
          engine: row.engine,
          modelVersion: row.model_version,
          rulesetVersion: row.ruleset_version,
          verdict: row.verdict as VerificationVerdict | 'uncertain',
          detectedValue: row.detected_value == null ? null : Number(row.detected_value),
          acceptedValue: row.accepted_value == null ? null : Number(row.accepted_value),
          reasonCodes: row.reason_codes ?? [],
          confidences: row.confidences ?? {},
          metrics: row.metrics ?? {},
        })),
        events,
      };
      return ok(detail);
    },

    getEvidenceUrl: async (storagePath) => {
      const { data, error } = await client.storage
        .from('evidence')
        .createSignedUrl(storagePath, 60 * 30);
      if (error || !data) {
        return failure('We could not open the evidence.', error);
      }
      return ok(data.signedUrl);
    },

    reviewEvent: async (attemptId, eventId, verdict, acceptedValue, reasonCode, reasonText) => {
      const { error } = await client.rpc('review_verification_event', {
        p_attempt_id: attemptId,
        p_event_id: eventId,
        p_verdict: verdict,
        p_accepted_value: acceptedValue,
        p_reason_code: reasonCode,
        p_reason_text: reasonText,
      });
      return error ? rpcFailure('The review could not be saved.', error) : ok(undefined);
    },

    finalize: async (attemptId) => {
      const { data, error } = await client.rpc('finalize_verification_attempt', {
        p_attempt_id: attemptId,
      });
      if (error) {
        return rpcFailure('The attempt could not be finalized.', error);
      }
      return ok(data as string);
    },
  };
}
