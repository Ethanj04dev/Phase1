-- ---------------------------------------------------------------------------
-- 0006 — candidate_profiles
--
-- The candidate's competitive identity: handle, pipeline, state, visibility.
-- Deliberately a separate table from athlete_profiles. One is training
-- configuration; this is who the person is in the community, and the two
-- carry different privacy rules. Performance, verification, rating and
-- ranking will each get their own tables in later milestones — folding
-- everything into one row is how a privacy rule gets missed.
--
-- Identity model:
--   * `handle` is the canonical lowercase form and is unique product-wide.
--     @Ethan and @ethan are the same handle; the database enforces it with a
--     lowercase CHECK plus a unique index, so no client bug can create both.
--   * `display_handle` is the candidate's own casing of the same handle.
--   * Real names are never required. display_name is optional.
--   * `state_code` is self-declared and the finest location ever stored.
--
-- What other users may see is defined ONLY by public_candidate_profiles at
-- the bottom of this file. The base table is owner-only under RLS.
--
-- Run this in the Supabase SQL editor. Additive, touches nothing that already
-- exists, and safe to run more than once.
-- ---------------------------------------------------------------------------

create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  -- One candidate identity per auth user. Deleting the account deletes the
  -- identity with it.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  handle text not null,
  display_handle text not null,
  display_name text,
  -- Owned by the app catalog, like goal_id: adding a pipeline is a code
  -- change, not a migration.
  pipeline_id text not null,
  state_code text,
  visibility text not null default 'private'
    check (visibility in ('public', 'private')),
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The app validates handles with friendlier messages; these constraints are
  -- the backstop that keeps a buggy or malicious client from writing a handle
  -- the rest of the product cannot render or deduplicate.
  constraint candidate_handle_is_canonical check (handle = lower(handle)),
  constraint candidate_handle_format check (handle ~ '^[a-z][a-z0-9_]{2,19}$'),
  -- display_handle is a casing of the same handle, never a second name.
  constraint candidate_display_handle_matches check (lower(display_handle) = handle),
  constraint candidate_bio_length check (bio is null or char_length(bio) <= 160),
  constraint candidate_display_name_length
    check (display_name is null or char_length(display_name) <= 50),
  constraint candidate_state_code_format
    check (state_code is null or state_code ~ '^[A-Z]{2}$')
);

-- Uniqueness on the canonical form is the whole identity model.
create unique index if not exists candidate_profiles_handle_key
  on public.candidate_profiles (handle);

-- The M4 leaderboard reads: candidates by pipeline, and by pipeline within a
-- state. Indexed now so the ranking queries land on prepared ground.
create index if not exists candidate_profiles_pipeline_idx
  on public.candidate_profiles (pipeline_id);
create index if not exists candidate_profiles_pipeline_state_idx
  on public.candidate_profiles (pipeline_id, state_code);

drop trigger if exists candidate_profiles_updated_at on public.candidate_profiles;
create trigger candidate_profiles_updated_at
  before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

-- Idempotent: a no-op when it is already on.
alter table public.candidate_profiles enable row level security;

-- Owner-only on the base table. Other users read candidates exclusively
-- through the view below, which is what makes "never expose X" enforceable in
-- one place.
drop policy if exists "candidates read own profile" on public.candidate_profiles;
create policy "candidates read own profile"
  on public.candidate_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "candidates create own profile" on public.candidate_profiles;
create policy "candidates create own profile"
  on public.candidate_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "candidates update own profile" on public.candidate_profiles;
create policy "candidates update own profile"
  on public.candidate_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "candidates delete own profile" on public.candidate_profiles;
create policy "candidates delete own profile"
  on public.candidate_profiles for delete
  using (auth.uid() = user_id);

revoke all on public.candidate_profiles from anon;

-- ---------------------------------------------------------------------------
-- Handle availability
--
-- SECURITY DEFINER because the question "is this handle taken" must consider
-- every profile, while RLS lets a user see only their own row. It returns a
-- boolean and nothing else: no row, no id, no hint of who holds the handle.
-- ---------------------------------------------------------------------------

create or replace function public.is_handle_available(candidate_handle text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.candidate_profiles
    where handle = lower(trim(candidate_handle))
  );
$$;

revoke all on function public.is_handle_available(text) from public;
grant execute on function public.is_handle_available(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The public face
--
-- The ONLY way other users ever read a candidate. Selecting from the base
-- table under someone else's session returns nothing; this view returns the
-- agreed public fields for public candidates and no one else.
--
-- Never in this view, by decision: user_id, visibility, bio (until profiles
-- ship), avatar (until avatars ship), and nothing resembling date of birth,
-- email, location finer than state, recruiter or application information.
-- ---------------------------------------------------------------------------

create or replace view public.public_candidate_profiles
with (security_invoker = off) as
  select
    id,
    handle,
    display_handle,
    display_name,
    pipeline_id,
    state_code,
    created_at
  from public.candidate_profiles
  where visibility = 'public';

revoke all on public.public_candidate_profiles from anon;
grant select on public.public_candidate_profiles to authenticated;
