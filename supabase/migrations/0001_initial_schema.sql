-- Phase 1 — initial schema
--
-- Design notes:
--
-- * Every table that holds athlete data has row-level security enabled in the
--   same statement block that creates it. RLS added later is RLS that was
--   briefly absent, and "briefly" is how data leaks.
--
-- * Programme content is NOT in the database. Programmes, weeks, days, sessions
--   and blocks are authored, ship with the app and are identical for everyone
--   on a track. Results therefore reference content by its stable string id
--   rather than by a foreign key. That keeps content versioned with the code
--   that renders it, and means a content change is a release, not a migration.
--
-- * Closed enumerations that will genuinely never grow (experience levels) use
--   CHECK constraints. Sets the product expects to extend (goals, tracks) are
--   plain text validated by the app, so adding a pipeline is a code change
--   rather than a database migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- athlete_profiles
-- ---------------------------------------------------------------------------

create table public.athlete_profiles (
  id uuid primary key default gen_random_uuid(),
  -- One profile per auth user. The unique constraint is what makes
  -- "the current athlete" a well-defined idea.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default 'Athlete',
  goal_id text not null,
  track_id text not null,
  running_experience text not null
    check (running_experience in ('none', 'beginner', 'intermediate', 'advanced')),
  swimming_experience text not null
    check (swimming_experience in ('none', 'beginner', 'intermediate', 'advanced')),
  rucking_experience text not null
    check (rucking_experience in ('none', 'beginner', 'intermediate', 'advanced')),
  training_days_per_week smallint not null
    check (training_days_per_week between 1 and 7),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger athlete_profiles_set_updated_at
  before update on public.athlete_profiles
  for each row execute function public.set_updated_at();

alter table public.athlete_profiles enable row level security;

create policy "athletes read own profile"
  on public.athlete_profiles for select
  using (auth.uid() = user_id);

create policy "athletes create own profile"
  on public.athlete_profiles for insert
  with check (auth.uid() = user_id);

create policy "athletes update own profile"
  on public.athlete_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "athletes delete own profile"
  on public.athlete_profiles for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Ownership helper
--
-- Child tables are owned through athlete_profiles. Wrapping the lookup in a
-- stable SECURITY DEFINER function keeps each policy to a single indexed
-- comparison and avoids repeating the subquery in twelve places.
-- ---------------------------------------------------------------------------

create or replace function public.current_athlete_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.athlete_profiles where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- assessment_results
--
-- Append-only by convention: retesting inserts a new row so history and
-- personal records stay honest. There is deliberately no update policy.
-- ---------------------------------------------------------------------------

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  event_id text not null,
  -- Repetitions or seconds, depending on the event. Never negative.
  value numeric not null check (value >= 0),
  recorded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index assessment_results_athlete_recorded_idx
  on public.assessment_results (athlete_id, recorded_at desc);

alter table public.assessment_results enable row level security;

create policy "athletes read own assessment results"
  on public.assessment_results for select
  using (athlete_id = public.current_athlete_id());

create policy "athletes insert own assessment results"
  on public.assessment_results for insert
  with check (athlete_id = public.current_athlete_id());

create policy "athletes delete own assessment results"
  on public.assessment_results for delete
  using (athlete_id = public.current_athlete_id());

-- ---------------------------------------------------------------------------
-- readiness_scores
--
-- Stored rather than derived on read, so a historical score stays meaningful
-- after the benchmark tables are retuned. benchmark_version records which
-- tables produced it.
-- ---------------------------------------------------------------------------

create table public.readiness_scores (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  overall smallint not null check (overall between 0 and 100),
  -- Per-category scores. jsonb rather than columns because the set of
  -- categories is a product decision that has already changed once.
  categories jsonb not null default '{}'::jsonb,
  strongest_category text,
  priority_category text,
  coverage numeric not null default 0 check (coverage between 0 and 1),
  benchmark_version integer not null default 1,
  created_at timestamptz not null default now()
);

create index readiness_scores_athlete_recorded_idx
  on public.readiness_scores (athlete_id, recorded_at desc);

alter table public.readiness_scores enable row level security;

create policy "athletes read own readiness scores"
  on public.readiness_scores for select
  using (athlete_id = public.current_athlete_id());

create policy "athletes insert own readiness scores"
  on public.readiness_scores for insert
  with check (athlete_id = public.current_athlete_id());

create policy "athletes delete own readiness scores"
  on public.readiness_scores for delete
  using (athlete_id = public.current_athlete_id());

-- ---------------------------------------------------------------------------
-- workout_results
-- ---------------------------------------------------------------------------

create table public.workout_results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  -- Stable content id of the workout day, e.g. program-selection_prep-w3-d1.
  -- Not a foreign key: programme content lives in the app, not the database.
  workout_day_id text not null,
  completed_at timestamptz not null default now(),
  duration_seconds integer not null check (duration_seconds >= 0),
  rpe smallint check (rpe between 1 and 10),
  notes text,
  -- Denormalised session total, so weekly volume does not require joining
  -- every exercise row of every workout in the athlete's history.
  distance_meters numeric not null default 0 check (distance_meters >= 0),
  created_at timestamptz not null default now()
);

create index workout_results_athlete_completed_idx
  on public.workout_results (athlete_id, completed_at desc);

alter table public.workout_results enable row level security;

create policy "athletes read own workout results"
  on public.workout_results for select
  using (athlete_id = public.current_athlete_id());

create policy "athletes insert own workout results"
  on public.workout_results for insert
  with check (athlete_id = public.current_athlete_id());

create policy "athletes update own workout results"
  on public.workout_results for update
  using (athlete_id = public.current_athlete_id())
  with check (athlete_id = public.current_athlete_id());

create policy "athletes delete own workout results"
  on public.workout_results for delete
  using (athlete_id = public.current_athlete_id());

-- ---------------------------------------------------------------------------
-- exercise_results
--
-- Owned transitively through workout_results. The policies join rather than
-- denormalising athlete_id, so there is exactly one place a row's owner is
-- recorded and no way for the two to disagree.
-- ---------------------------------------------------------------------------

create table public.exercise_results (
  id uuid primary key default gen_random_uuid(),
  workout_result_id uuid not null
    references public.workout_results (id) on delete cascade,
  -- Stable content id of the block, for the same reason as workout_day_id.
  workout_block_id text not null,
  rep_index smallint not null check (rep_index >= 1),
  duration_seconds numeric check (duration_seconds >= 0),
  distance_meters numeric check (distance_meters >= 0),
  reps smallint check (reps >= 0),
  load_pounds numeric check (load_pounds >= 0),
  rpe smallint check (rpe between 1 and 10),
  created_at timestamptz not null default now(),
  -- One row per repetition. Re-logging a rep updates it rather than
  -- accumulating duplicates.
  unique (workout_result_id, workout_block_id, rep_index)
);

create index exercise_results_workout_idx
  on public.exercise_results (workout_result_id);

alter table public.exercise_results enable row level security;

create policy "athletes read own exercise results"
  on public.exercise_results for select
  using (
    exists (
      select 1 from public.workout_results w
      where w.id = workout_result_id
        and w.athlete_id = public.current_athlete_id()
    )
  );

create policy "athletes insert own exercise results"
  on public.exercise_results for insert
  with check (
    exists (
      select 1 from public.workout_results w
      where w.id = workout_result_id
        and w.athlete_id = public.current_athlete_id()
    )
  );

create policy "athletes delete own exercise results"
  on public.exercise_results for delete
  using (
    exists (
      select 1 from public.workout_results w
      where w.id = workout_result_id
        and w.athlete_id = public.current_athlete_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Least privilege
--
-- anon can do nothing. Unauthenticated clients have no business reading
-- athlete data, and RLS alone would still allow an empty result set rather
-- than a hard denial.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

grant select, insert, update, delete on
  public.athlete_profiles,
  public.assessment_results,
  public.readiness_scores,
  public.workout_results,
  public.exercise_results
to authenticated;
