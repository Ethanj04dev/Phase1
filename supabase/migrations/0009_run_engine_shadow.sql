-- ---------------------------------------------------------------------------
-- 0009 — Run Engine shadow recording + ground-truth comparison
--
-- The Run Engine analyses GPS evidence and, in M3B, runs in SHADOW MODE:
-- its structured output is recorded beside the human ground-truth verdict
-- and influences nothing. This migration adds exactly two things:
--
--   1. record_shadow_analysis(): lets the submitting candidate's app (and
--      reviewers) write a SHADOW analysis row. Hard limits: the engine must
--      be in shadow authority under the current policy — so this path can
--      never write for 'evidence_integrity' or any promoted engine — and
--      shadow rows are invisible to every verdict path. Verdict composition
--      in finalize_verification_attempt() reads only the integrity engine
--      and human reviews; nothing here can touch an outcome.
--   2. shadow_disagreements: a reviewer-only view pairing each shadow
--      analysis with the authoritative ground-truth review of the same
--      event, so disagreement and false-verification rates are a query,
--      not a project.
--
-- When the Run Engine is promoted (M3C+), it moves server-side and its
-- authority flips in verification_policies — this client-fed shadow path
-- stays what it is: measurement.
--
-- Run in the Supabase SQL editor. Additive, safe to run more than once.
-- ---------------------------------------------------------------------------

create or replace function public.record_shadow_analysis(
  p_attempt_id uuid,
  p_event_id text,
  p_engine text,
  p_model_name text,
  p_model_version text,
  p_ruleset_version integer,
  p_claimed_value numeric,
  p_detected_value numeric,
  p_accepted_value numeric,
  p_verdict text,
  p_confidences jsonb,
  p_reason_codes text[],
  p_metrics jsonb
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_policy jsonb;
  v_policy_version integer;
  v_authority text;
  v_owner boolean;
  v_run_id uuid;
begin
  -- Caller must own the attempt or be an active reviewer.
  select exists (
    select 1 from public.assessment_attempts a
    where a.id = p_attempt_id and a.athlete_id = public.current_athlete_id()
  ) into v_owner;
  if not v_owner and not public.is_active_reviewer() then
    raise exception 'attempt_not_found';
  end if;

  if p_verdict not in ('verified', 'failed', 'unable_to_verify', 'uncertain') then
    raise exception 'invalid_verdict';
  end if;

  select version, policy into v_policy_version, v_policy
    from public.verification_policies order by version desc limit 1;

  -- The gate: only engines the current policy holds in SHADOW may be written
  -- through this function. 'evidence_integrity' is authoritative, so this
  -- refuses it; a promoted run engine would be refused the same way.
  v_authority := v_policy -> 'engines' -> p_engine ->> 'authority';
  if v_authority is null or v_authority <> 'shadow' then
    raise exception 'engine_not_in_shadow';
  end if;

  -- One shadow run per attempt; events append to it.
  select id into v_run_id from public.analysis_runs
    where attempt_id = p_attempt_id and trigger = 'shadow'
    limit 1;
  if v_run_id is null then
    insert into public.analysis_runs (attempt_id, session_id, trigger, policy_version)
    select p_attempt_id, s.id, 'shadow', v_policy_version
    from public.assessment_attempts a
    left join public.verification_sessions s on s.attempt_id = a.id
    where a.id = p_attempt_id
    returning id into v_run_id;
  end if;

  insert into public.analysis_events
    (run_id, event_id, engine, model_name, model_version, ruleset_version,
     claimed_value, detected_value, accepted_value, verdict,
     confidences, reason_codes, metrics)
  values
    (v_run_id, p_event_id, p_engine, p_model_name, p_model_version, p_ruleset_version,
     p_claimed_value, p_detected_value, p_accepted_value, p_verdict,
     coalesce(p_confidences, '{}'::jsonb), coalesce(p_reason_codes, '{}'),
     coalesce(p_metrics, '{}'::jsonb));

  return v_run_id;
end;
$$;

revoke all on function public.record_shadow_analysis(
  uuid, text, text, text, text, integer, numeric, numeric, numeric, text,
  jsonb, text[], jsonb) from public;
revoke all on function public.record_shadow_analysis(
  uuid, text, text, text, text, integer, numeric, numeric, numeric, text,
  jsonb, text[], jsonb) from anon;
grant execute on function public.record_shadow_analysis(
  uuid, text, text, text, text, integer, numeric, numeric, numeric, text,
  jsonb, text[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Ground-truth comparison. security_invoker, so the underlying reviewer-only
-- RLS on analysis_events and review visibility applies to whoever queries.
-- ---------------------------------------------------------------------------

create or replace view public.shadow_disagreements
with (security_invoker = on) as
select
  ar.attempt_id,
  ae.event_id,
  ae.engine,
  ae.model_name,
  ae.model_version,
  ae.ruleset_version,
  ae.verdict            as engine_verdict,
  ae.accepted_value     as engine_accepted_value,
  ae.claimed_value,
  ae.confidences        as engine_confidences,
  ae.reason_codes       as engine_reasons,
  r.verdict             as ground_truth_verdict,
  r.accepted_value      as ground_truth_accepted_value,
  r.reason_code         as ground_truth_reason,
  (ae.verdict is distinct from r.verdict)                as verdict_disagrees,
  (ae.accepted_value is distinct from r.accepted_value)  as value_disagrees,
  ae.created_at         as engine_analyzed_at,
  r.created_at          as ground_truth_at
from public.analysis_events ae
join public.analysis_runs ar on ar.id = ae.run_id
left join public.verification_event_reviews r
  on r.attempt_id = ar.attempt_id
 and r.event_id = ae.event_id
 and r.authoritative
where ar.trigger = 'shadow';

revoke all on public.shadow_disagreements from anon;
grant select on public.shadow_disagreements to authenticated;
