-- ---------------------------------------------------------------------------
-- 0004 — milestone_completions
--
-- The athlete's own preparation checklist: recruiter contacted, ASVAB sat,
-- MEPS done, contract held, ship date set.
--
-- Personal admin, not official process guidance. Routes into a career field
-- differ, people do these steps out of order, and some skip steps entirely, so
-- nothing here gates anything and no step is presented as required.
--
-- A toggle rather than an append-only log, unlike assessments and skill
-- ratings. A milestone is a current fact about someone's life, not a
-- performance history, and there is nothing worth keeping about a step someone
-- has told us they did not actually take. Unmarking deletes the row.
--
-- Run this in the Supabase SQL editor. It is additive, touches nothing that
-- already exists, and is safe to run more than once.
-- ---------------------------------------------------------------------------

create table if not exists public.milestone_completions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  -- Milestone ids are owned by the app catalog, not by the database, so adding
  -- a step to a Target stays a code change.
  milestone_id text not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- One row per step per athlete. This is what makes the write idempotent: a
  -- double tap upserts rather than creating a second row.
  unique (athlete_id, milestone_id)
);

create index if not exists milestone_completions_athlete_idx
  on public.milestone_completions (athlete_id);

alter table public.milestone_completions enable row level security;

drop policy if exists "athletes read own milestones" on public.milestone_completions;
create policy "athletes read own milestones"
  on public.milestone_completions for select
  using (athlete_id = public.current_athlete_id());

drop policy if exists "athletes insert own milestones" on public.milestone_completions;
create policy "athletes insert own milestones"
  on public.milestone_completions for insert
  with check (athlete_id = public.current_athlete_id());

-- Update is needed here where the other athlete-owned tables do not have it:
-- an upsert that collides with the unique pair becomes an update, which is how
-- re-marking a step stays a single row.
drop policy if exists "athletes update own milestones" on public.milestone_completions;
create policy "athletes update own milestones"
  on public.milestone_completions for update
  using (athlete_id = public.current_athlete_id())
  with check (athlete_id = public.current_athlete_id());

drop policy if exists "athletes delete own milestones" on public.milestone_completions;
create policy "athletes delete own milestones"
  on public.milestone_completions for delete
  using (athlete_id = public.current_athlete_id());

-- The anon role never reaches athlete data directly; every read goes through
-- an authenticated session subject to the policies above.
revoke all on public.milestone_completions from anon;
