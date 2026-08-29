-- ---------------------------------------------------------------------------
-- 0005 — selection_date on athlete_profiles
--
-- The athlete's own selection or ship date. Self-reported like a milestone:
-- Phase 1 records it, cannot verify it, and uses it only to anchor the
-- countdown ("14 weeks to selection") across Today and Road to Ready.
--
-- Nullable, and null on every existing row. No countdown renders without it.
--
-- Run this in the Supabase SQL editor. It is additive, rewrites nothing, and
-- is safe to run more than once. RLS is a table-level property already
-- enabled on athlete_profiles by 0001; a new column inherits the policies.
-- ---------------------------------------------------------------------------

alter table public.athlete_profiles
  add column if not exists selection_date date;

comment on column public.athlete_profiles.selection_date is
  'Athlete-reported selection/ship date used to anchor the countdown. Null when not set.';
