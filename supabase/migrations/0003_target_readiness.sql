-- ---------------------------------------------------------------------------
-- 0003 — target_readiness on readiness_scores
--
-- A readiness snapshot now records the same instant on two scales: the legacy
-- goal categories, and the athlete's Target domains.
--
-- Side by side rather than one replacing the other, because they are not
-- comparable. The same athlete scores differently under four goal-weighted
-- categories than under eight target-weighted domains, so overwriting the old
-- column would silently rewrite their history, and plotting both on one line
-- would show a jump that never happened.
--
-- Nullable, and null on every row written before this. A reader that finds
-- null must say so rather than substituting the legacy number.
--
-- Run this in the Supabase SQL editor. It is additive and rewrites nothing.
-- ---------------------------------------------------------------------------

alter table public.readiness_scores
  add column if not exists target_readiness jsonb;

comment on column public.readiness_scores.target_readiness is
  'Target-aware score for this instant: {targetId, overall, domains, strongestDomain, priorityDomain, coverage}. Null on rows written before Targets existed, and for athletes whose career has no Target definition.';

-- Row-level security is a table-level property and is already enabled on
-- readiness_scores by 0001. A new column inherits the existing policies, so
-- there is nothing further to grant or revoke here.
