-- ---------------------------------------------------------------------------
-- 0010 — landmark artifacts, per-rep ground truth, diversity ledger (M3C-2)
--
-- Three additions, all shadow-side:
--
--   1. landmark_artifacts — extracted landmark streams, stored as files in
--      the evidence bucket under derived/, registered here with the exact
--      extractor + model identity that produced them. Derived artifacts
--      live BESIDE evidence; source video is never modified or replaced.
--   2. rep_labels — frame-accurate per-rep ground truth from reviewers:
--      the labeled dataset every automated claim is measured against.
--   3. corpus_samples — the diversity ledger, tracked at the
--      athlete/session level from day one so clip volume can never
--      masquerade as dataset diversity.
--
-- Nothing in this file can touch verdicts: labels and artifacts are
-- measurement, written through definer functions, reviewer-gated.
--
-- Run in the Supabase SQL editor after 0009. Additive, safe to re-run.
-- ---------------------------------------------------------------------------

create table if not exists public.landmark_artifacts (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  attempt_id uuid references public.assessment_attempts (id) on delete cascade,
  event_id text,
  storage_path text not null,
  extractor_name text not null,
  extractor_version text not null,
  /** e.g. the pose model file's sha256, so "which model" is never a guess. */
  model_file_hash text,
  frame_count integer not null,
  fps numeric,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists landmark_artifacts_evidence_idx
  on public.landmark_artifacts (evidence_id);

create table if not exists public.rep_labels (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  event_id text not null,
  rep_index integer not null,
  start_ms integer,
  end_ms integer,
  label text not null check (label in ('valid', 'invalid', 'uncertain')),
  reason_codes text[] not null default '{}',
  notes text,
  labeler_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- One label per rep per labeler; relabeling replaces.
  constraint rep_labels_unique unique (attempt_id, event_id, rep_index, labeler_id)
);

create table if not exists public.corpus_samples (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  event_id text not null,
  athlete_id uuid not null,
  device_class text,
  camera_angle_class text,
  camera_distance_class text,
  lighting_class text,
  environment_class text,
  clothing_contrast_class text,
  body_proportion_class text,
  movement_style text,
  notes text,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (attempt_id, event_id)
);

alter table public.landmark_artifacts enable row level security;
alter table public.rep_labels enable row level security;
alter table public.corpus_samples enable row level security;

drop policy if exists "reviewers read landmark artifacts" on public.landmark_artifacts;
create policy "reviewers read landmark artifacts"
  on public.landmark_artifacts for select using (public.is_active_reviewer());
drop policy if exists "reviewers read rep labels" on public.rep_labels;
create policy "reviewers read rep labels"
  on public.rep_labels for select using (public.is_active_reviewer());
drop policy if exists "reviewers read corpus samples" on public.corpus_samples;
create policy "reviewers read corpus samples"
  on public.corpus_samples for select using (public.is_active_reviewer());

revoke all on public.landmark_artifacts from anon;
revoke all on public.rep_labels from anon;
revoke all on public.corpus_samples from anon;

-- Reviewers may store derived artifacts under derived/ in the evidence
-- bucket. Candidate uploads remain athlete-prefixed; the two cannot collide.
drop policy if exists "reviewers write derived artifacts" on storage.objects;
create policy "reviewers write derived artifacts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and name like 'derived/%'
    and public.is_active_reviewer()
  );

-- ---------------------------------------------------------------------------
-- Definer functions: registration and labeling
-- ---------------------------------------------------------------------------

create or replace function public.register_landmark_artifact(
  p_evidence_id uuid,
  p_storage_path text,
  p_extractor_name text,
  p_extractor_version text,
  p_model_file_hash text,
  p_frame_count integer,
  p_fps numeric
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_attempt uuid;
  v_event text;
  v_id uuid;
begin
  if not public.is_active_reviewer() then
    raise exception 'not_a_reviewer';
  end if;
  select s.attempt_id, e.event_id into v_attempt, v_event
  from public.evidence e
  join public.verification_sessions s on s.id = e.session_id
  where e.id = p_evidence_id;
  if v_event is null and v_attempt is null then
    raise exception 'evidence_not_found';
  end if;

  insert into public.landmark_artifacts
    (evidence_id, attempt_id, event_id, storage_path,
     extractor_name, extractor_version, model_file_hash, frame_count, fps,
     created_by)
  values
    (p_evidence_id, v_attempt, v_event, p_storage_path,
     p_extractor_name, p_extractor_version, p_model_file_hash, p_frame_count, p_fps,
     auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.save_rep_label(
  p_attempt_id uuid,
  p_event_id text,
  p_rep_index integer,
  p_start_ms integer,
  p_end_ms integer,
  p_label text,
  p_reason_codes text[],
  p_notes text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_active_reviewer() then
    raise exception 'not_a_reviewer';
  end if;
  if p_label not in ('valid', 'invalid', 'uncertain') then
    raise exception 'invalid_label';
  end if;
  insert into public.rep_labels
    (attempt_id, event_id, rep_index, start_ms, end_ms, label, reason_codes, notes, labeler_id)
  values
    (p_attempt_id, p_event_id, p_rep_index, p_start_ms, p_end_ms, p_label,
     coalesce(p_reason_codes, '{}'), p_notes, auth.uid())
  on conflict (attempt_id, event_id, rep_index, labeler_id)
  do update set
    start_ms = excluded.start_ms,
    end_ms = excluded.end_ms,
    label = excluded.label,
    reason_codes = excluded.reason_codes,
    notes = excluded.notes,
    created_at = now();
end;
$$;

create or replace function public.save_corpus_sample(
  p_attempt_id uuid,
  p_event_id text,
  p_device_class text,
  p_camera_angle_class text,
  p_camera_distance_class text,
  p_lighting_class text,
  p_environment_class text,
  p_clothing_contrast_class text,
  p_body_proportion_class text,
  p_movement_style text,
  p_notes text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_athlete uuid;
begin
  if not public.is_active_reviewer() then
    raise exception 'not_a_reviewer';
  end if;
  select athlete_id into v_athlete
    from public.assessment_attempts where id = p_attempt_id;
  if v_athlete is null then
    raise exception 'attempt_not_found';
  end if;
  insert into public.corpus_samples
    (attempt_id, event_id, athlete_id, device_class, camera_angle_class,
     camera_distance_class, lighting_class, environment_class,
     clothing_contrast_class, body_proportion_class, movement_style, notes,
     recorded_by)
  values
    (p_attempt_id, p_event_id, v_athlete, p_device_class, p_camera_angle_class,
     p_camera_distance_class, p_lighting_class, p_environment_class,
     p_clothing_contrast_class, p_body_proportion_class, p_movement_style, p_notes,
     auth.uid())
  on conflict (attempt_id, event_id)
  do update set
    device_class = excluded.device_class,
    camera_angle_class = excluded.camera_angle_class,
    camera_distance_class = excluded.camera_distance_class,
    lighting_class = excluded.lighting_class,
    environment_class = excluded.environment_class,
    clothing_contrast_class = excluded.clothing_contrast_class,
    body_proportion_class = excluded.body_proportion_class,
    movement_style = excluded.movement_style,
    notes = excluded.notes,
    recorded_by = excluded.recorded_by,
    created_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviewer views: per-rep disagreement and the diversity ledger summary
-- ---------------------------------------------------------------------------

create or replace view public.rep_label_disagreements
with (security_invoker = on) as
select
  ar.attempt_id,
  ae.event_id,
  (machine_rep.value ->> 'repNumber')::integer            as rep_index,
  machine_rep.value ->> 'verdict'                          as machine_verdict,
  l.label                                                  as ground_truth_label,
  (machine_rep.value ->> 'verdict') is distinct from l.label as disagrees,
  machine_rep.value -> 'reasonCodes'                       as machine_reasons,
  l.reason_codes                                           as ground_truth_reasons,
  ae.model_version,
  ae.ruleset_version,
  l.labeler_id
from public.analysis_events ae
join public.analysis_runs ar on ar.id = ae.run_id
cross join lateral jsonb_array_elements(ae.metrics -> 'reps') as machine_rep(value)
left join public.rep_labels l
  on l.attempt_id = ar.attempt_id
 and l.event_id = ae.event_id
 and l.rep_index = (machine_rep.value ->> 'repNumber')::integer
where ar.trigger = 'shadow'
  and ae.engine = 'calisthenics_pose';

revoke all on public.rep_label_disagreements from anon;
grant select on public.rep_label_disagreements to authenticated;

create or replace view public.corpus_ledger_summary
with (security_invoker = on) as
select
  count(distinct athlete_id)                        as athletes,
  count(*)                                          as samples,
  count(distinct camera_angle_class)                as angle_classes,
  count(distinct lighting_class)                    as lighting_classes,
  count(distinct environment_class)                 as environment_classes,
  count(distinct device_class)                      as device_classes,
  (select max(share) from (
     select count(*)::numeric / greatest(1, (select count(*) from public.corpus_samples)) as share
     from public.corpus_samples group by athlete_id
   ) shares)                                        as max_athlete_share
from public.corpus_samples;

revoke all on public.corpus_ledger_summary from anon;
grant select on public.corpus_ledger_summary to authenticated;

do $$
declare fn text;
begin
  foreach fn in array array[
    'register_landmark_artifact(uuid, text, text, text, text, integer, numeric)',
    'save_rep_label(uuid, text, integer, integer, integer, text, text[], text)',
    'save_corpus_sample(uuid, text, text, text, text, text, text, text, text, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('revoke all on function public.%s from anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
