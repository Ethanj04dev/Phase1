-- ---------------------------------------------------------------------------
-- 0002 — proficiency_ratings
--
-- Self-assessed skill levels for domains that cannot be timed or counted.
-- Water confidence is the first: "can you tread water calmly for ten minutes"
-- is not a number, and forcing it into seconds would invent a precision that
-- does not exist.
--
-- A separate table from assessment_results on purpose. One holds a measured
-- performance, the other holds the athlete's own judgement, and sharing
-- storage would eventually mean sharing a screen. A self-rating must never be
-- rendered as a test result.
--
-- Run this in the Supabase SQL editor. It is additive and touches nothing that
-- already exists.
-- ---------------------------------------------------------------------------

create table public.proficiency_ratings (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  -- Domain and skill ids are owned by the app catalog, not by the database, so
  -- adding a skill stays a code change. Stored as text for the same reason
  -- event_id is.
  domain_id text not null,
  skill_id text not null,
  -- The ordinal scale, deliberately coarse. Constrained here as well as in the
  -- app so a bad write cannot poison a readiness score.
  level text not null check (level in ('not_started', 'developing', 'competent', 'strong')),
  recorded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- Append-only, like assessment results: re-rating inserts a new row so the
-- athlete can see that treading went from developing to competent over a
-- winter. There is deliberately no update policy.
create index proficiency_ratings_athlete_recorded_idx
  on public.proficiency_ratings (athlete_id, recorded_at desc);

create index proficiency_ratings_skill_idx
  on public.proficiency_ratings (athlete_id, skill_id, recorded_at desc);

-- Enabled in the same block as the table, never as a follow-up step.
alter table public.proficiency_ratings enable row level security;

create policy "athletes read own proficiency ratings"
  on public.proficiency_ratings for select
  using (athlete_id = public.current_athlete_id());

create policy "athletes insert own proficiency ratings"
  on public.proficiency_ratings for insert
  with check (athlete_id = public.current_athlete_id());

create policy "athletes delete own proficiency ratings"
  on public.proficiency_ratings for delete
  using (athlete_id = public.current_athlete_id());

-- The anon role never reaches athlete data directly; every read goes through
-- an authenticated session subject to the policies above.
revoke all on public.proficiency_ratings from anon;
