-- ---------------------------------------------------------------------------
-- 0008 — verification foundation (M3A)
--
-- The verification "server", implemented as SECURITY DEFINER functions so it
-- deploys the same way as every other migration: pasted into the SQL editor.
-- Every timestamp that matters is stamped with the database's clock; every
-- status transition happens inside these functions; clients can only call
-- them, never write the tables directly.
--
-- Authority model (M3A):
--   * The evidence-integrity engine is deterministic and holds authority
--     from day one: an event whose evidence fails integrity is FAILED.
--   * Performance judgment (reps, times) is human ground truth for now —
--     reviewers issue event verdicts through review_verification_event().
--     Automated analysis engines will run in SHADOW mode beside them (M3B+)
--     and take authority event-by-event via verification_policies.
--   * The final verdict and official rating are computed here, in
--     finalize_verification_attempt(), never by any client.
--
-- Three outcomes everywhere: verified | failed | unable_to_verify.
-- Ambiguity is unable_to_verify, never a guess.
--
-- Run in the Supabase SQL editor. Additive, safe to run more than once.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Reviewers: who may issue ground-truth verdicts. Rows are added by the
-- project owner in the SQL editor; there is deliberately no self-service.
-- ---------------------------------------------------------------------------

create table if not exists public.reviewers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'reviewer' check (role in ('reviewer', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.reviewers enable row level security;

-- A user may see their own reviewer row (it is how the app decides whether
-- to show the console). Nothing else: no listing colleagues, no self-insert.
drop policy if exists "reviewers read own row" on public.reviewers;
create policy "reviewers read own row"
  on public.reviewers for select
  using (auth.uid() = user_id);

revoke all on public.reviewers from anon;

create or replace function public.is_active_reviewer()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.reviewers
    where user_id = auth.uid() and active
  );
$$;

-- ---------------------------------------------------------------------------
-- Verification sessions and the server-owned timeline
-- ---------------------------------------------------------------------------

create table if not exists public.verification_sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  definition_id text not null,
  definition_version integer not null,
  pipeline_id text not null,
  -- The protocol's event order, fixed at creation. Order enforcement reads
  -- this array; it cannot change mid-session.
  event_order text[] not null,
  challenge_code text not null unique,
  challenge_expires_at timestamptz not null,
  status text not null default 'issued'
    check (status in ('issued', 'active', 'submitted', 'interrupted', 'expired', 'abandoned')),
  -- Index into event_order of the currently open event, null when none open.
  open_event text,
  attempt_id uuid references public.assessment_attempts (id),
  device_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz
);

create index if not exists verification_sessions_athlete_idx
  on public.verification_sessions (athlete_id, created_at desc);

create table if not exists public.session_timeline_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.verification_sessions (id) on delete cascade,
  entry_type text not null check (entry_type in
    ('session_created', 'identity_committed', 'event_open', 'event_close',
     'evidence_committed', 'submitted', 'interrupted', 'abandoned')),
  event_id text,
  server_time timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists session_timeline_session_idx
  on public.session_timeline_entries (session_id, server_time);

create table if not exists public.session_event_claims (
  session_id uuid not null references public.verification_sessions (id) on delete cascade,
  event_id text not null,
  claimed_value numeric not null,
  event_order integer not null,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  primary key (session_id, event_id)
);

alter table public.verification_sessions enable row level security;
alter table public.session_timeline_entries enable row level security;
alter table public.session_event_claims enable row level security;

-- Owners and reviewers may read; NOBODY writes directly — all writes go
-- through the SECURITY DEFINER functions below.
drop policy if exists "own or reviewer read sessions" on public.verification_sessions;
create policy "own or reviewer read sessions"
  on public.verification_sessions for select
  using (athlete_id = public.current_athlete_id() or public.is_active_reviewer());

drop policy if exists "own or reviewer read timeline" on public.session_timeline_entries;
create policy "own or reviewer read timeline"
  on public.session_timeline_entries for select
  using (exists (
    select 1 from public.verification_sessions s
    where s.id = session_id
      and (s.athlete_id = public.current_athlete_id() or public.is_active_reviewer())
  ));

drop policy if exists "own or reviewer read claims" on public.session_event_claims;
create policy "own or reviewer read claims"
  on public.session_event_claims for select
  using (exists (
    select 1 from public.verification_sessions s
    where s.id = session_id
      and (s.athlete_id = public.current_athlete_id() or public.is_active_reviewer())
  ));

revoke all on public.verification_sessions from anon;
revoke all on public.session_timeline_entries from anon;
revoke all on public.session_event_claims from anon;

-- ---------------------------------------------------------------------------
-- Evidence records. Bytes live in the private 'evidence' storage bucket;
-- these rows are the ledger: what was captured, when, and its hash.
-- ---------------------------------------------------------------------------

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.verification_sessions (id) on delete cascade,
  -- Null event_id = the identity clip.
  event_id text,
  kind text not null check (kind in ('video', 'gps_trace')),
  content_hash text not null,
  hash_committed_at timestamptz not null default now(),
  client_captured_at timestamptz,
  duration_seconds numeric,
  byte_size bigint,
  mime_type text,
  storage_path text,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

-- The reuse gate: one hash, one place, ever — across every candidate.
create unique index if not exists evidence_content_hash_key
  on public.evidence (content_hash);
create index if not exists evidence_session_idx on public.evidence (session_id);

alter table public.evidence enable row level security;

drop policy if exists "own or reviewer read evidence" on public.evidence;
create policy "own or reviewer read evidence"
  on public.evidence for select
  using (exists (
    select 1 from public.verification_sessions s
    where s.id = session_id
      and (s.athlete_id = public.current_athlete_id() or public.is_active_reviewer())
  ));

revoke all on public.evidence from anon;

-- Private storage bucket. Uploads are scoped to the owner's own folder;
-- reads are owner-or-reviewer. Never public.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

drop policy if exists "evidence owner upload" on storage.objects;
create policy "evidence owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.current_athlete_id()::text
  );

drop policy if exists "evidence owner or reviewer read" on storage.objects;
create policy "evidence owner or reviewer read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and ((storage.foldername(name))[1] = public.current_athlete_id()::text
         or public.is_active_reviewer())
  );

-- ---------------------------------------------------------------------------
-- Analysis records: every engine's structured output, forever.
-- ---------------------------------------------------------------------------

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  session_id uuid references public.verification_sessions (id),
  trigger text not null default 'submission'
    check (trigger in ('submission', 'reprocess', 'adversarial_test', 'shadow')),
  policy_version integer not null,
  status text not null default 'complete' check (status in ('running', 'complete', 'error')),
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  event_id text,
  engine text not null,
  model_name text not null,
  model_version text not null,
  ruleset_version integer not null,
  claimed_value numeric,
  detected_value numeric,
  accepted_value numeric,
  verdict text not null
    check (verdict in ('verified', 'failed', 'unable_to_verify', 'uncertain')),
  confidences jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analysis_events_run_idx on public.analysis_events (run_id);

create table if not exists public.analysis_flags (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  severity text not null check (severity in ('info', 'suspicious', 'high_risk')),
  code text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.analysis_runs enable row level security;
alter table public.analysis_events enable row level security;
alter table public.analysis_flags enable row level security;

-- Reviewers see analysis; candidates see the sanitized outcome through the
-- attempt itself and their reviews, not the raw engine internals.
drop policy if exists "reviewers read analysis runs" on public.analysis_runs;
create policy "reviewers read analysis runs"
  on public.analysis_runs for select using (public.is_active_reviewer());
drop policy if exists "reviewers read analysis events" on public.analysis_events;
create policy "reviewers read analysis events"
  on public.analysis_events for select using (public.is_active_reviewer());
drop policy if exists "reviewers read analysis flags" on public.analysis_flags;
create policy "reviewers read analysis flags"
  on public.analysis_flags for select using (public.is_active_reviewer());

revoke all on public.analysis_runs from anon;
revoke all on public.analysis_events from anon;
revoke all on public.analysis_flags from anon;

-- ---------------------------------------------------------------------------
-- Verification policy: per-event authority (shadow | authoritative) and the
-- integrity tolerances. Versioned; promotion/demotion is an insert of a new
-- version, never an edit.
-- ---------------------------------------------------------------------------

create table if not exists public.verification_policies (
  version integer primary key,
  -- {"engines": {"evidence_integrity": {"authority": "authoritative"},
  --              "run_gps":            {"authority": "shadow"}, ...},
  --  "tolerances": {"clip_duration_slack_seconds": 20,
  --                  "transition_budget_seconds": 600}}
  policy jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);

insert into public.verification_policies (version, policy, notes)
values (1, '{
  "engines": {
    "evidence_integrity": {"authority": "authoritative"},
    "calisthenics_pose":  {"authority": "shadow"},
    "run_gps":            {"authority": "shadow"},
    "swim_tracking":      {"authority": "shadow"},
    "candidate_continuity": {"authority": "shadow"}
  },
  "tolerances": {
    "clip_duration_slack_seconds": 25,
    "transition_budget_seconds": 600,
    "session_ttl_hours": 4
  }
}'::jsonb, 'M3A initial policy: integrity deterministic and authoritative; all analysis engines shadow; humans are interim ground-truth authority.')
on conflict (version) do nothing;

alter table public.verification_policies enable row level security;
drop policy if exists "reviewers read policies" on public.verification_policies;
create policy "reviewers read policies"
  on public.verification_policies for select using (public.is_active_reviewer());
revoke all on public.verification_policies from anon;

-- ---------------------------------------------------------------------------
-- Ground-truth reviews and the audit log
-- ---------------------------------------------------------------------------

create table if not exists public.verification_event_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  event_id text not null,
  reviewer_id uuid not null references auth.users (id),
  reviewer_kind text not null default 'human' check (reviewer_kind in ('human', 'system')),
  verdict text not null check (verdict in ('verified', 'failed', 'unable_to_verify')),
  accepted_value numeric,
  reason_code text,
  reason_text text,
  authoritative boolean not null default true,
  created_at timestamptz not null default now()
);

-- One authoritative row per event per attempt; superseding review inserts a
-- new row after demoting the old one (see review_verification_event).
create unique index if not exists verification_event_reviews_authoritative_key
  on public.verification_event_reviews (attempt_id, event_id)
  where authoritative;

create table if not exists public.verification_actions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid,
  actor_id uuid,
  actor_role text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.verification_event_reviews enable row level security;
alter table public.verification_actions enable row level security;

drop policy if exists "own or reviewer read reviews" on public.verification_event_reviews;
create policy "own or reviewer read reviews"
  on public.verification_event_reviews for select
  using (
    public.is_active_reviewer()
    or exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.athlete_id = public.current_athlete_id()
    )
  );

drop policy if exists "reviewers read audit" on public.verification_actions;
create policy "reviewers read audit"
  on public.verification_actions for select using (public.is_active_reviewer());

revoke all on public.verification_event_reviews from anon;
revoke all on public.verification_actions from anon;

-- ---------------------------------------------------------------------------
-- Scoring configs, mirrored server-side so the official rating is computed
-- here. Seeded from the app catalog; a parity test in the repo pins the two.
-- ---------------------------------------------------------------------------

create table if not exists public.scoring_configs (
  definition_id text not null,
  definition_version integer not null,
  config_version integer not null,
  config jsonb not null,
  primary key (definition_id, definition_version, config_version)
);

alter table public.scoring_configs enable row level security;
drop policy if exists "authenticated read scoring configs" on public.scoring_configs;
create policy "authenticated read scoring configs"
  on public.scoring_configs for select to authenticated using (true);
revoke all on public.scoring_configs from anon;

insert into public.scoring_configs (definition_id, definition_version, config_version, config) values
('pj_ift', 1, 1, '{"events":[
 {"eventId":"pull_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":5,"points":120},{"value":10,"points":350},{"value":15,"points":600},{"value":20,"points":800},{"value":25,"points":920},{"value":30,"points":1000}]},
 {"eventId":"sit_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":30,"points":180},{"value":40,"points":350},{"value":50,"points":550},{"value":60,"points":700},{"value":70,"points":830},{"value":80,"points":920},{"value":100,"points":1000}]},
 {"eventId":"push_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":30,"points":200},{"value":40,"points":400},{"value":50,"points":600},{"value":60,"points":750},{"value":70,"points":870},{"value":80,"points":940},{"value":100,"points":1000}]},
 {"eventId":"run_1_5_mile","weight":1,"anchors":[{"value":450,"points":1000},{"value":480,"points":950},{"value":510,"points":880},{"value":540,"points":780},{"value":570,"points":660},{"value":600,"points":520},{"value":660,"points":320},{"value":720,"points":160},{"value":780,"points":60},{"value":840,"points":0}]},
 {"eventId":"swim_500m","weight":1,"anchors":[{"value":420,"points":1000},{"value":480,"points":900},{"value":540,"points":780},{"value":600,"points":620},{"value":660,"points":460},{"value":720,"points":300},{"value":840,"points":120},{"value":900,"points":0}]}]}'::jsonb),
('seal_pst', 1, 1, '{"events":[
 {"eventId":"swim_500m","weight":1,"anchors":[{"value":420,"points":1000},{"value":480,"points":900},{"value":540,"points":780},{"value":600,"points":620},{"value":660,"points":460},{"value":720,"points":300},{"value":840,"points":120},{"value":900,"points":0}]},
 {"eventId":"push_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":30,"points":200},{"value":40,"points":400},{"value":50,"points":600},{"value":60,"points":750},{"value":70,"points":870},{"value":80,"points":940},{"value":100,"points":1000}]},
 {"eventId":"sit_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":30,"points":180},{"value":40,"points":350},{"value":50,"points":550},{"value":60,"points":700},{"value":70,"points":830},{"value":80,"points":920},{"value":100,"points":1000}]},
 {"eventId":"pull_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":5,"points":120},{"value":10,"points":350},{"value":15,"points":600},{"value":20,"points":800},{"value":25,"points":920},{"value":30,"points":1000}]},
 {"eventId":"run_1_5_mile","weight":1,"anchors":[{"value":450,"points":1000},{"value":480,"points":950},{"value":510,"points":880},{"value":540,"points":780},{"value":570,"points":660},{"value":600,"points":520},{"value":660,"points":320},{"value":720,"points":160},{"value":780,"points":60},{"value":840,"points":0}]}]}'::jsonb),
('ranger_practice_battery', 1, 1, '{"events":[
 {"eventId":"push_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":30,"points":200},{"value":40,"points":400},{"value":50,"points":600},{"value":60,"points":750},{"value":70,"points":870},{"value":80,"points":940},{"value":100,"points":1000}]},
 {"eventId":"sit_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":30,"points":180},{"value":40,"points":350},{"value":50,"points":550},{"value":60,"points":700},{"value":70,"points":830},{"value":80,"points":920},{"value":100,"points":1000}]},
 {"eventId":"run_1_5_mile","weight":1,"anchors":[{"value":450,"points":1000},{"value":480,"points":950},{"value":510,"points":880},{"value":540,"points":780},{"value":570,"points":660},{"value":600,"points":520},{"value":660,"points":320},{"value":720,"points":160},{"value":780,"points":60},{"value":840,"points":0}]},
 {"eventId":"pull_ups","weight":1,"anchors":[{"value":0,"points":0},{"value":5,"points":120},{"value":10,"points":350},{"value":15,"points":600},{"value":20,"points":800},{"value":25,"points":920},{"value":30,"points":1000}]}]}'::jsonb)
on conflict (definition_id, definition_version, config_version) do nothing;

-- Piecewise-linear interpolation, mirroring src/domain/scoring/score.ts.
create or replace function public.compute_official_rating(
  p_definition_id text,
  p_definition_version integer,
  p_results jsonb  -- {"pull_ups": 18, "run_1_5_mile": 537, ...}
)
returns integer
language plpgsql stable security definer set search_path = public
as $$
declare
  v_config jsonb;
  v_curve jsonb;
  v_anchors jsonb;
  v_event text;
  v_value numeric;
  v_weight numeric;
  v_points numeric;
  v_lower jsonb;
  v_upper jsonb;
  v_i integer;
  v_sum numeric := 0;
  v_weight_total numeric := 0;
begin
  select config into v_config
  from public.scoring_configs
  where definition_id = p_definition_id
    and definition_version = p_definition_version
  order by config_version desc
  limit 1;

  if v_config is null then
    return null;
  end if;

  for v_curve in select * from jsonb_array_elements(v_config -> 'events') loop
    v_event := v_curve ->> 'eventId';
    if not (p_results ? v_event) then
      -- Incomplete performances never get a number. Same rule as the app.
      return null;
    end if;
    v_value := (p_results ->> v_event)::numeric;
    v_weight := (v_curve ->> 'weight')::numeric;
    v_anchors := v_curve -> 'anchors';

    if v_value <= (v_anchors -> 0 ->> 'value')::numeric then
      v_points := (v_anchors -> 0 ->> 'points')::numeric;
    elsif v_value >= (v_anchors -> (jsonb_array_length(v_anchors) - 1) ->> 'value')::numeric then
      v_points := (v_anchors -> (jsonb_array_length(v_anchors) - 1) ->> 'points')::numeric;
    else
      v_i := 1;
      while v_value > (v_anchors -> v_i ->> 'value')::numeric loop
        v_i := v_i + 1;
      end loop;
      v_lower := v_anchors -> (v_i - 1);
      v_upper := v_anchors -> v_i;
      v_points := (v_lower ->> 'points')::numeric
        + ((v_value - (v_lower ->> 'value')::numeric)
           / ((v_upper ->> 'value')::numeric - (v_lower ->> 'value')::numeric))
        * ((v_upper ->> 'points')::numeric - (v_lower ->> 'points')::numeric);
    end if;

    v_points := least(1000, greatest(0, v_points));
    v_sum := v_sum + v_points * v_weight;
    v_weight_total := v_weight_total + v_weight;
  end loop;

  if v_weight_total = 0 then
    return null;
  end if;
  return round(v_sum / v_weight_total)::integer;
end;
$$;

-- ---------------------------------------------------------------------------
-- The session lifecycle functions. All SECURITY DEFINER; all clock-stamping
-- with now(); all validating against server state, never trusting payloads.
-- ---------------------------------------------------------------------------

-- Unambiguous base32-style challenge, e.g. K7F-29Q.
create or replace function public.generate_challenge_code()
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  raw bytea := gen_random_bytes(6);
  code text := '';
  i integer;
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(raw, i) % length(alphabet)) + 1, 1);
  end loop;
  return substr(code, 1, 3) || '-' || substr(code, 4, 3);
end;
$$;

create or replace function public.create_verification_session(
  p_definition_id text,
  p_definition_version integer,
  p_pipeline_id text,
  p_event_order text[],
  p_device_metadata jsonb default '{}'::jsonb
)
returns public.verification_sessions
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_athlete uuid := public.current_athlete_id();
  v_ttl_hours integer;
  v_session public.verification_sessions;
begin
  if v_athlete is null then
    raise exception 'no_athlete_profile';
  end if;
  if array_length(p_event_order, 1) is null then
    raise exception 'empty_event_order';
  end if;

  -- One live session at a time; stale ones expire on the way in.
  update public.verification_sessions
    set status = 'expired'
    where athlete_id = v_athlete
      and status in ('issued', 'active', 'interrupted')
      and challenge_expires_at < now();
  if exists (
    select 1 from public.verification_sessions
    where athlete_id = v_athlete and status in ('issued', 'active', 'interrupted')
  ) then
    raise exception 'session_already_active';
  end if;

  select coalesce((policy -> 'tolerances' ->> 'session_ttl_hours')::integer, 4)
    into v_ttl_hours
    from public.verification_policies order by version desc limit 1;

  insert into public.verification_sessions
    (athlete_id, definition_id, definition_version, pipeline_id, event_order,
     challenge_code, challenge_expires_at, device_metadata)
  values
    (v_athlete, p_definition_id, p_definition_version, p_pipeline_id, p_event_order,
     public.generate_challenge_code(), now() + make_interval(hours => v_ttl_hours),
     coalesce(p_device_metadata, '{}'::jsonb))
  returning * into v_session;

  insert into public.session_timeline_entries (session_id, entry_type, metadata)
  values (v_session.id, 'session_created',
          jsonb_build_object('definition', p_definition_id, 'version', p_definition_version));

  return v_session;
end;
$$;

-- Shared guard: the caller's own, unexpired session.
create or replace function public.own_session(p_session_id uuid)
returns public.verification_sessions
language plpgsql stable security definer set search_path = public
as $$
declare
  v_session public.verification_sessions;
begin
  select * into v_session from public.verification_sessions
    where id = p_session_id and athlete_id = public.current_athlete_id();
  if v_session.id is null then
    raise exception 'session_not_found';
  end if;
  if v_session.challenge_expires_at < now()
     and v_session.status in ('issued', 'active', 'interrupted') then
    raise exception 'session_expired';
  end if;
  return v_session;
end;
$$;

-- Commit a piece of evidence: the hash arrives the moment capture stops.
-- The identity clip (event_id null) activates an issued session.
create or replace function public.commit_evidence(
  p_session_id uuid,
  p_event_id text,
  p_kind text,
  p_content_hash text,
  p_client_captured_at timestamptz,
  p_duration_seconds numeric,
  p_byte_size bigint,
  p_mime_type text
)
returns public.evidence
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_session public.verification_sessions := public.own_session(p_session_id);
  v_evidence public.evidence;
begin
  if p_event_id is null then
    if v_session.status <> 'issued' then
      raise exception 'identity_already_committed';
    end if;
  else
    if v_session.status <> 'active' or v_session.open_event is distinct from p_event_id then
      raise exception 'event_not_open';
    end if;
  end if;

  begin
    insert into public.evidence
      (session_id, event_id, kind, content_hash, client_captured_at,
       duration_seconds, byte_size, mime_type)
    values
      (p_session_id, p_event_id, p_kind, p_content_hash, p_client_captured_at,
       p_duration_seconds, p_byte_size, p_mime_type)
    returning * into v_evidence;
  exception when unique_violation then
    -- The reuse gate. The same bytes cannot serve two performances.
    raise exception 'evidence_reused';
  end;

  if p_event_id is null then
    update public.verification_sessions
      set status = 'active', started_at = now() where id = p_session_id;
    insert into public.session_timeline_entries (session_id, entry_type, metadata)
    values (p_session_id, 'identity_committed',
            jsonb_build_object('hash', left(p_content_hash, 12)));
  else
    insert into public.session_timeline_entries (session_id, entry_type, event_id, metadata)
    values (p_session_id, 'evidence_committed', p_event_id,
            jsonb_build_object('hash', left(p_content_hash, 12), 'kind', p_kind));
  end if;

  return v_evidence;
end;
$$;

create or replace function public.register_evidence_upload(
  p_evidence_id uuid,
  p_storage_path text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1 from public.evidence e
    join public.verification_sessions s on s.id = e.session_id
    where e.id = p_evidence_id and s.athlete_id = public.current_athlete_id()
  ) into v_ok;
  if not v_ok then
    raise exception 'evidence_not_found';
  end if;
  update public.evidence
    set storage_path = p_storage_path, received_at = now()
    where id = p_evidence_id;
end;
$$;

-- Open the next event. Order is enforced here: only the first unclosed event
-- in the session's fixed event_order may open.
create or replace function public.open_session_event(
  p_session_id uuid,
  p_event_id text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_session public.verification_sessions := public.own_session(p_session_id);
  v_expected text;
begin
  if v_session.status <> 'active' then
    raise exception 'session_not_active';
  end if;
  if v_session.open_event is not null then
    raise exception 'event_already_open';
  end if;

  select e into v_expected
  from unnest(v_session.event_order) with ordinality as t(e, ord)
  where e not in (select event_id from public.session_event_claims where session_id = p_session_id)
  order by ord
  limit 1;

  if v_expected is null then
    raise exception 'all_events_closed';
  end if;
  if v_expected <> p_event_id then
    raise exception 'event_out_of_order';
  end if;

  update public.verification_sessions set open_event = p_event_id where id = p_session_id;
  insert into public.session_timeline_entries (session_id, entry_type, event_id)
  values (p_session_id, 'event_open', p_event_id);
end;
$$;

create or replace function public.close_session_event(
  p_session_id uuid,
  p_event_id text,
  p_claimed_value numeric
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_session public.verification_sessions := public.own_session(p_session_id);
  v_opened timestamptz;
  v_order integer;
begin
  if v_session.status <> 'active' or v_session.open_event is distinct from p_event_id then
    raise exception 'event_not_open';
  end if;
  if not exists (
    select 1 from public.evidence
    where session_id = p_session_id and event_id = p_event_id
  ) then
    raise exception 'no_evidence_committed';
  end if;

  select server_time into v_opened
  from public.session_timeline_entries
  where session_id = p_session_id and event_id = p_event_id and entry_type = 'event_open'
  order by server_time desc limit 1;

  select ord::integer - 1 into v_order
  from unnest(v_session.event_order) with ordinality as t(e, ord)
  where e = p_event_id;

  insert into public.session_event_claims
    (session_id, event_id, claimed_value, event_order, opened_at, closed_at)
  values (p_session_id, p_event_id, p_claimed_value, v_order, v_opened, now());

  update public.verification_sessions set open_event = null where id = p_session_id;
  insert into public.session_timeline_entries (session_id, entry_type, event_id, metadata)
  values (p_session_id, 'event_close', p_event_id,
          jsonb_build_object('claimed_value', p_claimed_value));
end;
$$;

create or replace function public.abandon_verification_session(p_session_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_session public.verification_sessions;
begin
  select * into v_session from public.verification_sessions
    where id = p_session_id and athlete_id = public.current_athlete_id();
  if v_session.id is null then
    raise exception 'session_not_found';
  end if;
  if v_session.status in ('submitted') then
    raise exception 'session_already_submitted';
  end if;
  update public.verification_sessions
    set status = 'abandoned', open_event = null where id = p_session_id;
  insert into public.session_timeline_entries (session_id, entry_type)
  values (p_session_id, 'abandoned');
end;
$$;

-- ---------------------------------------------------------------------------
-- Submission: attempt creation + the evidence-integrity engine.
-- ---------------------------------------------------------------------------

create or replace function public.submit_verification_session(p_session_id uuid)
returns uuid  -- attempt id
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_session public.verification_sessions := public.own_session(p_session_id);
  v_policy jsonb;
  v_policy_version integer;
  v_slack numeric;
  v_transition_budget numeric;
  v_attempt_id uuid;
  v_run_id uuid;
  v_event text;
  v_claim record;
  v_prev_close timestamptz;
  v_reasons text[];
  v_verdict text;
  v_evidence record;
  v_window_seconds numeric;
begin
  if v_session.status <> 'active' then
    raise exception 'session_not_active';
  end if;
  if v_session.open_event is not null then
    raise exception 'event_still_open';
  end if;
  if exists (
    select 1
    from unnest(v_session.event_order) as required(event_id)
    where required.event_id not in
      (select event_id from public.session_event_claims where session_id = p_session_id)
  ) then
    raise exception 'events_missing';
  end if;

  select version, policy into v_policy_version, v_policy
    from public.verification_policies order by version desc limit 1;
  v_slack := coalesce((v_policy -> 'tolerances' ->> 'clip_duration_slack_seconds')::numeric, 25);
  v_transition_budget :=
    coalesce((v_policy -> 'tolerances' ->> 'transition_budget_seconds')::numeric, 600);

  -- The attempt: created server-side, pending review. This function runs as
  -- the definer, which is what lets it write a status no client can.
  insert into public.assessment_attempts
    (athlete_id, definition_id, definition_version, pipeline_id, status,
     occurred_at, started_at, completed_at, submitted_at,
     verification_status, verification_method, notes)
  values
    (v_session.athlete_id, v_session.definition_id, v_session.definition_version,
     v_session.pipeline_id, 'completed',
     v_session.started_at, v_session.started_at, now(), now(),
     'pending_review', 'video_review', null)
  returning id into v_attempt_id;

  insert into public.attempt_event_results (attempt_id, event_id, value, event_order)
  select v_attempt_id, event_id, claimed_value, event_order
  from public.session_event_claims where session_id = p_session_id;

  update public.verification_sessions
    set status = 'submitted', submitted_at = now(), attempt_id = v_attempt_id
    where id = p_session_id;
  insert into public.session_timeline_entries (session_id, entry_type)
  values (p_session_id, 'submitted');

  -- ---- Evidence-integrity engine (deterministic, authoritative) ----------
  insert into public.analysis_runs (attempt_id, session_id, trigger, policy_version)
  values (v_attempt_id, p_session_id, 'submission', v_policy_version)
  returning id into v_run_id;

  -- Session-level checks land on the identity row (event_id null).
  v_reasons := '{}';
  if not exists (
    select 1 from public.evidence
    where session_id = p_session_id and event_id is null and received_at is not null
  ) then
    v_reasons := array_append(v_reasons, 'identity_clip_missing');
  end if;
  insert into public.analysis_events
    (run_id, event_id, engine, model_name, model_version, ruleset_version, verdict, reason_codes)
  values
    (v_run_id, null, 'evidence_integrity', 'deterministic', '1', 1,
     case when array_length(v_reasons, 1) is null then 'verified' else 'failed' end,
     v_reasons);

  v_prev_close := null;
  for v_claim in
    select * from public.session_event_claims
    where session_id = p_session_id order by event_order
  loop
    v_reasons := '{}';

    select * into v_evidence from public.evidence
      where session_id = p_session_id and event_id = v_claim.event_id
      order by hash_committed_at limit 1;

    if v_evidence.id is null then
      v_reasons := array_append(v_reasons, 'evidence_missing');
    else
      if v_evidence.received_at is null then
        v_reasons := array_append(v_reasons, 'evidence_not_uploaded');
      end if;
      -- Clip must roughly span the server-clocked event window.
      v_window_seconds := extract(epoch from v_claim.closed_at - v_claim.opened_at);
      if v_evidence.duration_seconds is not null
         and abs(v_window_seconds - v_evidence.duration_seconds) > v_slack then
        v_reasons := array_append(v_reasons, 'duration_window_mismatch');
      end if;
      -- The hash must have been committed inside the event window.
      if v_evidence.hash_committed_at < v_claim.opened_at
         or v_evidence.hash_committed_at > v_claim.closed_at + interval '60 seconds' then
        v_reasons := array_append(v_reasons, 'hash_outside_window');
      end if;
    end if;

    -- Transition budget: rest since the previous event's close.
    if v_prev_close is not null
       and extract(epoch from v_claim.opened_at - v_prev_close) > v_transition_budget then
      v_reasons := array_append(v_reasons, 'transition_budget_exceeded');
      insert into public.analysis_flags (run_id, severity, code, detail)
      values (v_run_id, 'suspicious', 'transition_budget_exceeded',
              jsonb_build_object('event', v_claim.event_id,
                'gap_seconds', extract(epoch from v_claim.opened_at - v_prev_close)));
    end if;
    v_prev_close := v_claim.closed_at;

    v_verdict := case when array_length(v_reasons, 1) is null then 'verified' else 'failed' end;

    insert into public.analysis_events
      (run_id, event_id, engine, model_name, model_version, ruleset_version,
       claimed_value, verdict, reason_codes,
       metrics)
    values
      (v_run_id, v_claim.event_id, 'evidence_integrity', 'deterministic', '1', 1,
       v_claim.claimed_value, v_verdict, v_reasons,
       jsonb_build_object('window_seconds',
         extract(epoch from v_claim.closed_at - v_claim.opened_at)));
  end loop;

  insert into public.verification_actions (attempt_id, actor_id, actor_role, action, payload)
  values (v_attempt_id, auth.uid(), 'candidate', 'submitted',
          jsonb_build_object('session', p_session_id));

  return v_attempt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ground-truth review and the final verdict
-- ---------------------------------------------------------------------------

create or replace function public.review_verification_event(
  p_attempt_id uuid,
  p_event_id text,
  p_verdict text,
  p_accepted_value numeric,
  p_reason_code text,
  p_reason_text text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.is_active_reviewer() then
    raise exception 'not_a_reviewer';
  end if;
  select ap.user_id into v_owner
  from public.assessment_attempts a
  join public.athlete_profiles ap on ap.id = a.athlete_id
  where a.id = p_attempt_id;
  if v_owner is null then
    raise exception 'attempt_not_found';
  end if;
  if v_owner = auth.uid() then
    raise exception 'cannot_review_own_attempt';
  end if;
  if p_verdict not in ('verified', 'failed', 'unable_to_verify') then
    raise exception 'invalid_verdict';
  end if;
  if p_verdict = 'verified' and p_accepted_value is null then
    raise exception 'accepted_value_required';
  end if;
  if p_verdict <> 'verified' and coalesce(p_reason_code, '') = '' then
    raise exception 'reason_required';
  end if;

  -- Supersede, never overwrite: the old authoritative row survives.
  update public.verification_event_reviews
    set authoritative = false
    where attempt_id = p_attempt_id and event_id = p_event_id and authoritative;

  insert into public.verification_event_reviews
    (attempt_id, event_id, reviewer_id, reviewer_kind, verdict,
     accepted_value, reason_code, reason_text, authoritative)
  values
    (p_attempt_id, p_event_id, auth.uid(), 'human', p_verdict,
     p_accepted_value, p_reason_code, p_reason_text, true);

  insert into public.verification_actions (attempt_id, actor_id, actor_role, action, payload)
  values (p_attempt_id, auth.uid(), 'reviewer', 'event_reviewed',
          jsonb_build_object('event', p_event_id, 'verdict', p_verdict,
                             'accepted_value', p_accepted_value));
end;
$$;

-- Composes the assessment verdict and, when verified, computes the official
-- rating from ACCEPTED values. Integrity failures compose in automatically.
create or replace function public.finalize_verification_attempt(p_attempt_id uuid)
returns text  -- resulting verification_status
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_attempt public.assessment_attempts;
  v_event record;
  v_any_failed boolean := false;
  v_any_utv boolean := false;
  v_results jsonb := '{}'::jsonb;
  v_verdict text;
  v_reason text;
  v_rating integer;
begin
  if not public.is_active_reviewer() then
    raise exception 'not_a_reviewer';
  end if;
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if v_attempt.id is null then
    raise exception 'attempt_not_found';
  end if;
  if v_attempt.verification_status <> 'pending_review' then
    raise exception 'attempt_not_pending';
  end if;

  for v_event in
    select r.event_id, r.value as claimed
    from public.attempt_event_results r
    where r.attempt_id = p_attempt_id
    order by r.event_order
  loop
    -- Integrity engine verdict (authoritative from day one).
    if exists (
      select 1 from public.analysis_events ae
      join public.analysis_runs ar on ar.id = ae.run_id
      where ar.attempt_id = p_attempt_id
        and ae.engine = 'evidence_integrity'
        and ae.event_id = v_event.event_id
        and ae.verdict = 'failed'
    ) then
      v_any_failed := true;
      v_reason := coalesce(v_reason, 'evidence_integrity');
      continue;
    end if;

    -- Ground-truth verdict (the interim human authority).
    declare
      v_review public.verification_event_reviews;
    begin
      select * into v_review from public.verification_event_reviews
        where attempt_id = p_attempt_id and event_id = v_event.event_id and authoritative;
      if v_review.id is null then
        raise exception 'event_not_reviewed: %', v_event.event_id;
      end if;
      if v_review.verdict = 'failed' then
        v_any_failed := true;
        v_reason := coalesce(v_reason, v_review.reason_code);
      elsif v_review.verdict = 'unable_to_verify' then
        v_any_utv := true;
        v_reason := coalesce(v_reason, v_review.reason_code);
      else
        v_results := v_results || jsonb_build_object(v_event.event_id, v_review.accepted_value);
      end if;
    end;
  end loop;

  -- Identity/session-level integrity failure rejects regardless of events.
  if exists (
    select 1 from public.analysis_events ae
    join public.analysis_runs ar on ar.id = ae.run_id
    where ar.attempt_id = p_attempt_id
      and ae.engine = 'evidence_integrity'
      and ae.event_id is null
      and ae.verdict = 'failed'
  ) then
    v_any_failed := true;
    v_reason := coalesce(v_reason, 'identity_integrity');
  end if;

  if v_any_failed then
    v_verdict := 'rejected';
  elsif v_any_utv then
    v_verdict := 'rejected';   -- stored status; reason class distinguishes it
    v_reason := coalesce(v_reason, 'unable_to_verify');
  else
    v_verdict := 'zero_verified';
    v_rating := public.compute_official_rating(
      v_attempt.definition_id, v_attempt.definition_version, v_results);
    if v_rating is null then
      raise exception 'rating_computation_failed';
    end if;
  end if;

  update public.assessment_attempts
    set verification_status = v_verdict,
        verified_at = case when v_verdict = 'zero_verified' then now() else null end,
        official_rating = v_rating,
        notes = case when v_verdict = 'rejected'
                     then coalesce('verification:' || v_reason, notes) else notes end
    where id = p_attempt_id;

  insert into public.verification_actions (attempt_id, actor_id, actor_role, action, payload)
  values (p_attempt_id, auth.uid(), 'reviewer', 'finalized',
          jsonb_build_object('verdict', v_verdict, 'official_rating', v_rating,
                             'reason', v_reason));

  return v_verdict;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviewer visibility into submitted attempts. The M2 owner-only policies
-- stand; this adds exactly one thing: reviewers may READ attempts that have
-- entered the verification lifecycle. Self-reported practice data stays
-- private to its owner — reviewers have no business there.
-- ---------------------------------------------------------------------------

drop policy if exists "reviewers read submitted attempts" on public.assessment_attempts;
create policy "reviewers read submitted attempts"
  on public.assessment_attempts for select
  using (
    public.is_active_reviewer()
    and verification_status <> 'self_reported'
  );

drop policy if exists "reviewers read submitted attempt events" on public.attempt_event_results;
create policy "reviewers read submitted attempt events"
  on public.attempt_event_results for select
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id
      and public.is_active_reviewer()
      and a.verification_status <> 'self_reported'
  ));

-- ---------------------------------------------------------------------------
-- Grants: callable by signed-in users; every function re-checks identity and
-- role internally. anon gets nothing.
-- ---------------------------------------------------------------------------

do $$
declare fn text;
begin
  foreach fn in array array[
    'is_active_reviewer()',
    'generate_challenge_code()',
    'compute_official_rating(text, integer, jsonb)',
    'create_verification_session(text, integer, text, text[], jsonb)',
    'own_session(uuid)',
    'commit_evidence(uuid, text, text, text, timestamptz, numeric, bigint, text)',
    'register_evidence_upload(uuid, text)',
    'open_session_event(uuid, text)',
    'close_session_event(uuid, text, numeric)',
    'abandon_verification_session(uuid)',
    'submit_verification_session(uuid)',
    'review_verification_event(uuid, text, text, numeric, text, text)',
    'finalize_verification_attempt(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('revoke all on function public.%s from anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
