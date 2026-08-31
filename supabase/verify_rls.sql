-- Phase 1 — row-level security verification
--
-- Paste into the Supabase SQL Editor and run. Every row should read PASS.
--
-- This is worth re-running after any schema change. Row-level security is the
-- only thing standing between one athlete's training history and another's,
-- and it fails silently: a missing policy does not error, it just quietly
-- returns rows to someone who should not see them.

with expected as (
  select unnest(array[
    'athlete_profiles',
    'candidate_profiles',
    'assessment_results',
    'assessment_attempts',
    'attempt_event_results',
    'verification_sessions',
    'session_timeline_entries',
    'session_event_claims',
    'evidence',
    'analysis_runs',
    'analysis_events',
    'analysis_flags',
    'verification_event_reviews',
    'verification_actions',
    'verification_policies',
    'scoring_configs',
    'reviewers',
    'landmark_artifacts',
    'rep_labels',
    'corpus_samples',
    'proficiency_ratings',
    'milestone_completions',
    'readiness_scores',
    'workout_results',
    'exercise_results'
  ]) as table_name
),

-- 1. Every table exists and has RLS switched on.
rls_status as (
  select
    e.table_name,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    (c.oid is not null) as table_exists
  from expected e
  left join pg_class c
    on c.relname = e.table_name
   and c.relnamespace = 'public'::regnamespace
),

-- 2. Every table has at least a read and a write policy.
policy_counts as (
  select
    e.table_name,
    count(p.policyname) filter (where p.cmd = 'SELECT') as select_policies,
    count(p.policyname) filter (where p.cmd = 'INSERT') as insert_policies,
    count(p.policyname) as total_policies
  from expected e
  left join pg_policies p
    on p.tablename = e.table_name
   and p.schemaname = 'public'
  group by e.table_name
),

-- 3. Every policy is actually scoped to the caller. A policy of "true" is a
--    policy that protects nothing.
unscoped as (
  select
    p.tablename as table_name,
    count(*) as unscoped_policies
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in (select table_name from expected)
    and coalesce(p.qual, p.with_check, '') not like '%current_athlete_id%'
    and coalesce(p.qual, p.with_check, '') not like '%auth.uid%'
    and coalesce(p.qual, p.with_check, '') not like '%workout_results%'
    and coalesce(p.qual, p.with_check, '') not like '%is_active_reviewer%'
    -- scoring_configs is deliberately world-readable content (authenticated).
    and p.tablename <> 'scoring_configs'
  group by p.tablename
)

select
  r.table_name,
  case when r.table_exists then 'PASS' else 'FAIL — table missing' end as table_check,
  case when r.rls_enabled then 'PASS' else 'FAIL — RLS OFF' end as rls_check,
  case
    -- Verification tables are written ONLY by SECURITY DEFINER functions:
    -- a client INSERT policy on them would be a hole, not a feature.
    when r.table_name in (
      'verification_sessions','session_timeline_entries','session_event_claims',
      'evidence','analysis_runs','analysis_events','analysis_flags',
      'verification_event_reviews','verification_actions',
      'verification_policies','scoring_configs','reviewers',
      'landmark_artifacts','rep_labels','corpus_samples'
    ) then case
      when pc.select_policies > 0 and pc.insert_policies = 0 then 'PASS'
      when pc.insert_policies > 0 then 'FAIL — client write policy on definer-only table'
      else 'FAIL — missing read policy'
    end
    when pc.select_policies > 0 and pc.insert_policies > 0 then 'PASS'
    else 'FAIL — missing read or write policy'
  end as policy_check,
  case
    when coalesce(u.unscoped_policies, 0) = 0 then 'PASS'
    else 'FAIL — ' || u.unscoped_policies || ' policy not scoped to the caller'
  end as scoping_check,
  pc.total_policies
from rls_status r
join policy_counts pc on pc.table_name = r.table_name
left join unscoped u on u.table_name = r.table_name
order by r.table_name;

-- 4. anon must hold no privileges on athlete data. RLS alone would return an
--    empty set; revoking the grant refuses the request outright.
select
  'anon privileges' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL — anon can ' || string_agg(distinct privilege_type, ', ') end as result
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name in (
    'athlete_profiles','candidate_profiles','assessment_results',
    'assessment_attempts','attempt_event_results',
    'readiness_scores','workout_results','exercise_results'
  );

-- 7. The client must not be able to update attempts: verification verdicts
--    and official ratings are service-role writes only.
select
  'assessment_attempts no client update' as check_name,
  case when count(*) = 0 then 'PASS'
       else 'FAIL — update policy exists' end as result
from pg_policies
where schemaname = 'public'
  and tablename = 'assessment_attempts'
  and cmd = 'UPDATE';

-- 6. The public candidate view must expose only the agreed identity columns.
--    A new column appearing here is a privacy decision, not a refactor.
select
  'public_candidate_profiles columns' as check_name,
  case
    when count(*) = 0 then 'FAIL — view missing'
    when array_agg(column_name::text order by column_name) =
         array['created_at','display_handle','display_name','handle','id','pipeline_id','state_code']
      then 'PASS'
    else 'FAIL — columns are ' || string_agg(column_name::text, ', ' order by column_name)
  end as result
from information_schema.columns
where table_schema = 'public'
  and table_name = 'public_candidate_profiles';

-- 5. The ownership helper must be SECURITY DEFINER, or the policies that call
--    it cannot read athlete_profiles to resolve ownership.
select
  'current_athlete_id()' as check_name,
  case
    when count(*) = 0 then 'FAIL — function missing'
    when bool_and(p.prosecdef) then 'PASS'
    else 'FAIL — not SECURITY DEFINER'
  end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'current_athlete_id';
