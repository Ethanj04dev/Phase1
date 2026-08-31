import { useCallback, useEffect, useRef, useState } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import { findAssessmentEvent, type AssessmentEventId } from '@/domain/assessment/types';
import type { AssessmentDefinition } from '@/domain/attempt/definition';
import { analyzeRun } from '@/domain/runEngine/analyze';
import {
  RUN_ENGINE_NAME,
  RUN_ENGINE_VERSION,
  RUN_RULESET_VERSION,
} from '@/domain/runEngine/ruleset';
import type { RunTrace } from '@/domain/runEngine/types';
import type { SessionEventClaim, VerificationSession } from '@/domain/verification/types';
import { hashFileSha256 } from '@/lib/hashFile';

/**
 * Drives one verified assessment session.
 *
 * The server owns the state; this hook mirrors it. Every transition is an
 * RPC that can refuse (expired session, out-of-order event, reused
 * evidence), and every refusal surfaces as a human sentence rather than a
 * crash. Local knowledge is a cache for rendering, rebuilt from the server
 * on mount so an app restart resumes exactly where the session really is.
 */

export type SessionPhase =
  | 'loading'
  | 'none' // no active session — preflight can start one
  | 'identity' // session issued, identity clip not yet committed
  | 'between_events' // active, no event open — next event can begin
  | 'event_open' // recording window open for openEvent
  | 'ready_to_submit' // every event closed
  | 'submitted';

export interface VerifiedSessionState {
  phase: SessionPhase;
  session: VerificationSession | null;
  claims: readonly SessionEventClaim[];
  /** The next event in protocol order, when one remains. */
  nextEvent: AssessmentEventId | null;
  attemptId: string | null;
  busy: boolean;
  error: string | null;
}

function derivePhase(
  session: VerificationSession | null,
  claims: readonly SessionEventClaim[],
): { phase: SessionPhase; nextEvent: AssessmentEventId | null } {
  if (!session) {
    return { phase: 'none', nextEvent: null };
  }
  if (session.status === 'submitted') {
    return { phase: 'submitted', nextEvent: null };
  }
  if (session.status === 'issued') {
    return { phase: 'identity', nextEvent: null };
  }
  if (session.openEvent) {
    return { phase: 'event_open', nextEvent: session.openEvent };
  }
  const closed = new Set(claims.map((claim) => claim.eventId));
  const next = session.eventOrder.find((eventId) => !closed.has(eventId)) ?? null;
  return next
    ? { phase: 'between_events', nextEvent: next }
    : { phase: 'ready_to_submit', nextEvent: null };
}

export function useVerifiedSession() {
  const { verification } = useRepositories();

  const [session, setSession] = useState<VerificationSession | null>(null);
  const [claims, setClaims] = useState<readonly SessionEventClaim[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const active = await verification.getActiveSession();
    if (!active.ok) {
      setError(active.error.message);
      setLoaded(true);
      return;
    }
    setSession(active.value);
    if (active.value) {
      const loadedClaims = await verification.getClaims(active.value.id);
      setClaims(loadedClaims.ok ? loadedClaims.value : []);
    } else {
      setClaims([]);
    }
    setLoaded(true);
  }, [verification]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Wraps an action with busy/error handling; returns success. */
  const run = useCallback(async (action: () => Promise<string | null>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const failure = await action();
      if (failure) {
        setError(failure);
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const begin = useCallback(
    (definition: AssessmentDefinition) =>
      run(async () => {
        const created = await verification.createSession(
          definition.id,
          definition.version,
          definition.pipelineId,
          definition.events.map((event) => event.eventId),
        );
        if (!created.ok) {
          return created.error.message;
        }
        setSession(created.value);
        setClaims([]);
        return null;
      }),
    [run, verification],
  );

  /** Raw traces kept in memory for shadow analysis after submission. */
  const tracesRef = useRef<Map<AssessmentEventId, RunTrace>>(new Map());

  /** Hash → commit → upload, for any piece of evidence. */
  const captureFile = useCallback(
    (
      eventId: AssessmentEventId | null,
      kind: 'video' | 'gps_trace',
      localUri: string,
      durationSeconds: number,
      mimeType: string,
    ) =>
      run(async () => {
        if (!session) {
          return 'No active session.';
        }
        const { hash, byteSize } = await hashFileSha256(localUri);
        const committed = await verification.commitEvidence(
          session.id,
          eventId,
          kind,
          hash,
          new Date().toISOString(),
          durationSeconds,
          byteSize,
          mimeType,
        );
        if (!committed.ok) {
          return committed.error.message;
        }
        const uploaded = await verification.uploadEvidence(
          committed.value.evidenceId,
          session.id,
          localUri,
          mimeType,
        );
        if (!uploaded.ok) {
          return uploaded.error.message;
        }
        if (eventId === null) {
          // Identity activates the session server-side; mirror it.
          setSession((current) =>
            current ? { ...current, status: 'active', openEvent: null } : current,
          );
        }
        return null;
      }),
    [run, session, verification],
  );

  const captureClip = useCallback(
    (eventId: AssessmentEventId | null, localUri: string, durationSeconds: number) =>
      captureFile(eventId, 'video', localUri, durationSeconds, 'video/mp4'),
    [captureFile],
  );

  const captureRunTrace = useCallback(
    async (
      eventId: AssessmentEventId,
      fileUri: string,
      trace: RunTrace,
      durationSeconds: number,
    ): Promise<boolean> => {
      const committed = await captureFile(
        eventId,
        'gps_trace',
        fileUri,
        durationSeconds,
        'application/json',
      );
      if (committed) {
        tracesRef.current.set(eventId, trace);
      }
      return committed;
    },
    [captureFile],
  );

  const openEvent = useCallback(
    (eventId: AssessmentEventId) =>
      run(async () => {
        if (!session) {
          return 'No active session.';
        }
        const opened = await verification.openEvent(session.id, eventId);
        if (!opened.ok) {
          return opened.error.message;
        }
        setSession((current) => (current ? { ...current, openEvent: eventId } : current));
        return null;
      }),
    [run, session, verification],
  );

  const closeEvent = useCallback(
    (eventId: AssessmentEventId, claimedValue: number) =>
      run(async () => {
        if (!session) {
          return 'No active session.';
        }
        const closed = await verification.closeEvent(session.id, eventId, claimedValue);
        if (!closed.ok) {
          return closed.error.message;
        }
        setSession((current) => (current ? { ...current, openEvent: null } : current));
        const refreshed = await verification.getClaims(session.id);
        if (refreshed.ok) {
          setClaims(refreshed.value);
        }
        return null;
      }),
    [run, session, verification],
  );

  const submit = useCallback(
    () =>
      run(async () => {
        if (!session) {
          return 'No active session.';
        }
        const submitted = await verification.submit(session.id);
        if (!submitted.ok) {
          return submitted.error.message;
        }
        setAttemptId(submitted.value);
        setSession((current) => (current ? { ...current, status: 'submitted' } : current));

        // Shadow analysis: the Run Engine analyses each captured trace and
        // records its structured result beside the ground-truth path. Shadow
        // failures never fail a submission — they are measurement, and the
        // server refuses shadow rows for any engine holding authority.
        const currentClaims = await verification.getClaims(session.id);
        const claimByEvent = new Map(
          (currentClaims.ok ? currentClaims.value : claims).map((claim) => [
            claim.eventId,
            claim,
          ]),
        );
        for (const [eventId, trace] of tracesRef.current) {
          const event = findAssessmentEvent(eventId);
          const claim = claimByEvent.get(eventId);
          if (!event?.distanceMeters || !claim) {
            continue;
          }
          const analysis = analyzeRun({
            trace,
            requiredDistanceMeters: event.distanceMeters,
            sessionWindow: {
              openedAtMs: Date.parse(claim.openedAt),
              closedAtMs: Date.parse(claim.closedAt),
            },
          });
          await verification.recordShadowAnalysis(submitted.value, eventId, {
            engine: RUN_ENGINE_NAME,
            modelName: 'deterministic',
            modelVersion: RUN_ENGINE_VERSION,
            rulesetVersion: RUN_RULESET_VERSION,
            claimedValue: claim.claimedValue,
            detectedValue: analysis.computedDistanceMeters,
            acceptedValue: analysis.acceptedTimeSeconds,
            verdict: analysis.verdict,
            confidences: analysis.confidences,
            reasonCodes: analysis.reasonCodes,
            metrics: {
              rawDistanceMeters: analysis.rawDistanceMeters,
              computedDistanceMeters: analysis.computedDistanceMeters,
              elapsedSeconds: analysis.elapsedSeconds,
              quality: analysis.quality,
              pace: analysis.pace,
              continuity: analysis.continuity,
              anomalies: analysis.anomalies,
            },
          });
        }
        return null;
      }),
    [claims, run, session, verification],
  );

  const abandon = useCallback(
    () =>
      run(async () => {
        if (!session) {
          return null;
        }
        const abandoned = await verification.abandon(session.id);
        if (!abandoned.ok) {
          return abandoned.error.message;
        }
        setSession(null);
        setClaims([]);
        return null;
      }),
    [run, session, verification],
  );

  const { phase, nextEvent } = derivePhase(session, claims);

  const state: VerifiedSessionState = {
    phase: loaded ? phase : 'loading',
    session,
    claims,
    nextEvent,
    attemptId,
    busy,
    error,
  };

  return {
    state,
    begin,
    captureClip,
    captureRunTrace,
    openEvent,
    closeEvent,
    submit,
    abandon,
    refresh,
  };
}
