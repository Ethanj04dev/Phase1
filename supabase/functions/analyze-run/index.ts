// Server-side Run Engine execution (shadow).
//
// This is the authoritative-flow shape, running in shadow: it analyses the
// UPLOADED evidence — the hashed, committed trace in the private bucket —
// never anything the client computed. When the Run Engine is promoted, this
// function's output is what policy consumes; the client's own shadow
// recording becomes redundant and is retired.
//
// Deploy (owner step, one-time CLI setup then per-change):
//   supabase functions deploy analyze-run
//
// Invoke (any signed-in client; the function authorises internally):
//   POST /functions/v1/analyze-run  { "attemptId": "<uuid>" }
//
// The engine modules in ../_shared/runEngine are byte-synced from
// src/domain/runEngine by scripts/sync-run-engine.mjs and pinned by a
// parity test — the server runs exactly the engine the benchmark measured.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { analyzeRun } from '../_shared/runEngine/analyze.ts';
import {
  RUN_ENGINE_NAME,
  RUN_ENGINE_VERSION,
  RUN_RULESET_VERSION,
} from '../_shared/runEngine/ruleset.ts';
import type { RunTrace } from '../_shared/runEngine/types.ts';

// Distances the protocols require, mirrored from the app event catalog.
const REQUIRED_DISTANCE_METERS: Record<string, number> = {
  run_1_mile: 1609.344,
  run_1_5_mile: 2414.016,
  ruck_3_mile: 4828.032,
};

Deno.serve(async (request) => {
  try {
    const authHeader = request.headers.get('Authorization') ?? '';
    const { attemptId } = (await request.json()) as { attemptId?: string };
    if (!attemptId) {
      return json({ error: 'attemptId required' }, 400);
    }

    // Caller identity via their own JWT; data access via service role.
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await anonClient.auth.getUser();
    if (!userData?.user) {
      return json({ error: 'unauthorized' }, 401);
    }

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Caller must own the attempt or be an active reviewer.
    const { data: attempt } = await service
      .from('assessment_attempts')
      .select('id, athlete_id, athlete_profiles!inner(user_id)')
      .eq('id', attemptId)
      .maybeSingle();
    if (!attempt) {
      return json({ error: 'attempt not found' }, 404);
    }
    const ownerId = (attempt as { athlete_profiles: { user_id: string } })
      .athlete_profiles.user_id;
    if (ownerId !== userData.user.id) {
      const { data: reviewer } = await service
        .from('reviewers')
        .select('active')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (!reviewer?.active) {
        return json({ error: 'forbidden' }, 403);
      }
    }

    // The engine must be in shadow under current policy — this function
    // refuses to run for a promoted engine through the shadow path.
    const { data: policyRow } = await service
      .from('verification_policies')
      .select('version, policy')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const authority = (policyRow?.policy as {
      engines?: Record<string, { authority?: string }>;
    })?.engines?.[RUN_ENGINE_NAME]?.authority;
    if (authority !== 'shadow') {
      return json({ error: 'engine not in shadow' }, 409);
    }

    // Load the session, claims and the gps_trace evidence for run events.
    const { data: session } = await service
      .from('verification_sessions')
      .select('id')
      .eq('attempt_id', attemptId)
      .maybeSingle();
    if (!session) {
      return json({ error: 'no verification session for attempt' }, 404);
    }

    const [{ data: claims }, { data: evidence }] = await Promise.all([
      service.from('session_event_claims').select('*').eq('session_id', session.id),
      service
        .from('evidence')
        .select('id, event_id, kind, storage_path')
        .eq('session_id', session.id)
        .eq('kind', 'gps_trace'),
    ]);

    const results: Record<string, unknown> = {};
    for (const item of (evidence ?? []) as {
      id: string;
      event_id: string | null;
      storage_path: string | null;
    }[]) {
      const eventId = item.event_id;
      const required = eventId ? REQUIRED_DISTANCE_METERS[eventId] : undefined;
      if (!eventId || !required || !item.storage_path) {
        continue;
      }
      const claim = ((claims ?? []) as {
        event_id: string;
        claimed_value: number;
        opened_at: string;
        closed_at: string;
      }[]).find((row) => row.event_id === eventId);

      const download = await service.storage.from('evidence').download(item.storage_path);
      if (download.error || !download.data) {
        results[eventId] = { error: 'evidence download failed' };
        continue;
      }
      const trace = JSON.parse(await download.data.text()) as RunTrace;

      const analysis = analyzeRun({
        trace,
        requiredDistanceMeters: required,
        sessionWindow: claim
          ? {
              openedAtMs: Date.parse(claim.opened_at),
              closedAtMs: Date.parse(claim.closed_at),
            }
          : undefined,
      });

      // One server-shadow run per attempt; events append to it.
      let { data: run } = await service
        .from('analysis_runs')
        .select('id')
        .eq('attempt_id', attemptId)
        .eq('trigger', 'shadow')
        .limit(1)
        .maybeSingle();
      if (!run) {
        const inserted = await service
          .from('analysis_runs')
          .insert({
            attempt_id: attemptId,
            session_id: session.id,
            trigger: 'shadow',
            policy_version: policyRow?.version ?? 1,
          })
          .select('id')
          .single();
        run = inserted.data;
      }
      if (!run) {
        results[eventId] = { error: 'analysis run creation failed' };
        continue;
      }

      await service.from('analysis_events').insert({
        run_id: run.id,
        event_id: eventId,
        engine: RUN_ENGINE_NAME,
        model_name: 'deterministic-server',
        model_version: RUN_ENGINE_VERSION,
        ruleset_version: RUN_RULESET_VERSION,
        claimed_value: claim?.claimed_value ?? null,
        detected_value: analysis.computedDistanceMeters,
        accepted_value: analysis.acceptedTimeSeconds,
        verdict: analysis.verdict,
        confidences: analysis.confidences,
        reason_codes: analysis.reasonCodes,
        metrics: {
          rawDistanceMeters: analysis.rawDistanceMeters,
          computedDistanceMeters: analysis.computedDistanceMeters,
          distanceUncertaintyMeters: analysis.distanceUncertaintyMeters,
          acceptedTimeUncertaintySeconds: analysis.acceptedTimeUncertaintySeconds,
          elapsedSeconds: analysis.elapsedSeconds,
          routeFingerprint: analysis.routeFingerprint,
          quality: analysis.quality,
          pace: analysis.pace,
          continuity: analysis.continuity,
          anomalies: analysis.anomalies,
        },
      });

      results[eventId] = { verdict: analysis.verdict };
    }

    return json({ analyzed: results }, 200);
  } catch (error) {
    return json({ error: `analysis failed: ${String(error)}` }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
