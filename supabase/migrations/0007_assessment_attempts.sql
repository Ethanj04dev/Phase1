-- ---------------------------------------------------------------------------
-- 0007 — assessment_attempts + attempt_event_results
--
-- The competitive record. A complete assessment attempt — one sitting, one
-- protocol, every event — is the only thing that will ever generate an
-- official rating or enter a leaderboard. Individual event results
-- (assessment_results) remain training data and are untouched here.
--
-- Trust boundary, enforced in this file rather than promised in a comment:
--
--   * Inserts may only claim verification_status 'self_reported', with no
--     official rating and no verification timestamps. The INSERT policy's
--     WITH CHECK refuses anything more ambitious.
--   * There is NO client UPDATE policy on attempts. Status transitions
--     (pending_review → zero_verified / rejected) and official ratings are
--     written by the service role in M3, which bypasses RLS deliberately.
--   * estimated_rating is the client's clearly-labelled preview and is
--     stored as such; official_rating stays null until a server writes it.
--
-- Event results live in their own table rather than a JSON column so that
-- M3 verification can attach accepted/adjusted values per event without
-- rewriting the athlete's submitted claim.
--
-- Run this in the Supabase SQL editor. Additive, safe to run more than once.
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  -- The protocol this attempt was performed under. Owned by the app catalog;
  -- the version is stamped so a protocol change can never rewrite history.
  definition_id text not null,
  definition_version integer not null,
  pipeline_id text not null,
  status text not null
    check (status in ('completed', 'incomplete', 'aborted', 'failed')),
  -- When the assessment was performed (self-stated for practice attempts),
  -- plus the verification lifecycle, all kept separately for freshness rules.
  occurred_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  submitted_at timestamptz,
  verified_at timestamptz,
  verification_status text not null default 'self_reported'
    check (verification_status in
      ('self_reported', 'pending_review', 'zero_verified', 'proctored', 'rejected')),
  verification_method text not null default 'self_reported'
    check (verification_method in
      ('self_reported', 'video_review', 'sensor_data', 'device_integration',
       'community_review', 'approved_proctor', 'trusted_organization',
       'automated_review')),
  -- The client's clearly-labelled preview, 0–1000, with the scoring config
  -- version that produced it.
  estimated_rating integer
    check (estimated_rating is null or (estimated_rating between 0 and 1000)),
  scoring_config_version integer,
  -- Server-issued only. Null until M3 verification writes it.
  official_rating integer
    check (official_rating is null or (official_rating between 0 and 1000)),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists assessment_attempts_athlete_occurred_idx
  on public.assessment_attempts (athlete_id, occurred_at desc);

-- The future leaderboard read: eligible attempts by pipeline and protocol.
create index if not exists assessment_attempts_pipeline_idx
  on public.assessment_attempts (pipeline_id, verification_status, occurred_at desc);

create table if not exists public.attempt_event_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  event_id text not null,
  value numeric not null,
  event_order integer not null,
  -- One result per event per attempt: an attempt is a single performance of
  -- the protocol, not a collection to pick a best from.
  constraint attempt_event_results_unique_event unique (attempt_id, event_id)
);

create index if not exists attempt_event_results_attempt_idx
  on public.attempt_event_results (attempt_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.assessment_attempts enable row level security;
alter table public.attempt_event_results enable row level security;

drop policy if exists "athletes read own attempts" on public.assessment_attempts;
create policy "athletes read own attempts"
  on public.assessment_attempts for select
  using (athlete_id = public.current_athlete_id());

-- The WITH CHECK is the trust boundary: a client insert that claims to be
-- verified, carries an official rating, or backdates verification timestamps
-- is refused by the database, whatever the app code says.
drop policy if exists "athletes insert own self-reported attempts" on public.assessment_attempts;
create policy "athletes insert own self-reported attempts"
  on public.assessment_attempts for insert
  with check (
    athlete_id = public.current_athlete_id()
    and verification_status = 'self_reported'
    and verification_method = 'self_reported'
    and official_rating is null
    and submitted_at is null
    and verified_at is null
  );

-- No UPDATE policy on purpose: nothing about a performance is editable by
-- the client after the fact. Deleting a self-reported practice attempt is
-- allowed; anything past self-reported is part of the verified record and
-- only the service role can touch it.
drop policy if exists "athletes delete own self-reported attempts" on public.assessment_attempts;
create policy "athletes delete own self-reported attempts"
  on public.assessment_attempts for delete
  using (
    athlete_id = public.current_athlete_id()
    and verification_status = 'self_reported'
  );

drop policy if exists "athletes read own attempt events" on public.attempt_event_results;
create policy "athletes read own attempt events"
  on public.attempt_event_results for select
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id and a.athlete_id = public.current_athlete_id()
  ));

-- Event rows may only be attached to the athlete's own attempts, and only
-- while those attempts are still self-reported — once an attempt enters
-- review, its submitted results are frozen.
drop policy if exists "athletes insert own attempt events" on public.attempt_event_results;
create policy "athletes insert own attempt events"
  on public.attempt_event_results for insert
  with check (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id
      and a.athlete_id = public.current_athlete_id()
      and a.verification_status = 'self_reported'
  ));

drop policy if exists "athletes delete own attempt events" on public.attempt_event_results;
create policy "athletes delete own attempt events"
  on public.attempt_event_results for delete
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id
      and a.athlete_id = public.current_athlete_id()
      and a.verification_status = 'self_reported'
  ));

revoke all on public.assessment_attempts from anon;
revoke all on public.attempt_event_results from anon;
