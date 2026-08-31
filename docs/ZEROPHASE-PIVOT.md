# Zero Phase — pivot architecture and roadmap

**Phase 1 the workout tracker is over. Zero Phase is the competitive
performance network for special operations candidates.** The leaderboard is
the product; verification makes it credible; improvement keeps candidates
coming back.

    TRAIN → TEST → VERIFY → RANK → IMPROVE → RETEST

This document is the inspection the pivot brief asked for: what survives,
what dies, what the data model becomes, where fraud is stopped, and the order
of work. Nothing in here is built yet, deliberately.

---

## 1. The codebase verdict

Inventory at time of writing: 39 route files, 117 source modules, 30 test
suites (516 tests), 7 Supabase tables with RLS verified, Supabase email auth
with a boot gate and local-to-account data migration.

### Keep as-is (load-bearing for the pivot)

| Asset | Why it survives |
|---|---|
| Repository seam (`Result<T>`, interfaces, local/Supabase/mock) | Screens never learned where data lives. The pivot swaps what is behind the seam, not the seam. |
| Supabase auth, boot gate, `migrateLocalData` | Account infrastructure is priority #1 of the brief and already works. |
| Theme system (black/blue/white, machined surfaces, grain, press scale, motion) | The brief keeps the visual direction verbatim. This is the "Nike/WHOOP not military-cheese" layer, already built. |
| The gauge | Reads 0–1000 as naturally as 0–100. Becomes the Zero Score instrument. |
| Assessment event model (`AssessmentEvent`: unit, direction, protocol) | This *is* the assessment data model the brief asks for. Protocol text on screen is already how Test day works. |
| Test day flow + timestamp-derived stopwatch | The direct ancestor of Verified Assessment Mode. The stopwatch discipline (elapsed from timestamps, survives a locked phone) is exactly what a verifiable run/swim timer needs. |
| `Verified<T>` / provenance philosophy | The product already refuses to present unverified claims as facts. The pivot generalises this from *content* provenance to *performance* provenance. |
| Pipeline definitions (`TargetDefinition` for PJ, Ranger, SEAL) | Rename to `PipelineDefinition`. Per-pipeline events, weights and rationale are precisely the per-pipeline scoring configuration the brief requires. Three of the eight launch pipelines already exist. |
| Countdown + selection date | Candidate context that no competitor has. Keeps its place on Home. |
| Contrast gate, a11y patterns, sentence-case voice, disclaimers module | The credibility layer. The brief's terminology rules (§19) are already this codebase's culture. |

### Refactor (same bones, new job)

| Today | Becomes |
|---|---|
| `goalId` / goal catalog | `pipelineId` / pipeline catalog. The rename the docs have owed since migration `0003`. |
| `TargetDefinition` | `PipelineDefinition` + a versioned `ScoringConfig` (see §5). |
| Target-aware readiness (0–100, weighted domains, renormalised coverage) | The Zero Score engine (0–1000). Same shape: per-event curves → per-category scores → weighted aggregate. The renormalisation logic becomes "score what is verified". |
| Road to Ready (weighted-headroom priority engine) | The Performance Gap engine (§9 of the brief) — literally the same algorithm with rank-threshold targets instead of benchmark targets in a later phase. |
| Test day | Verified Assessment Mode: same flow, plus attempt records, per-event verification status, and the on-camera code. |
| Today screen | Home: competitive dashboard (score, rank, movement, edge/weakness, next target). |
| Evidence screen ("how this number is computed") | Survives almost unchanged — auditability of the Zero Score is a differentiator no black-box competitor can copy. |

### Demote (keep the code, remove from the spotlight)

- **Training programmes, tracks, target-aware adaptation** — the brief says
  training is secondary but not eliminated. The engine stays; it loses its
  tab and resurfaces later inside Home/Improve as "what to train to climb".
- **Milestones, career intel, pipeline map, physical demands** — candidate-
  context content. Folds into the pipeline detail behind Profile/Rankings,
  off the main navigation.
- **Streaks / weekly volume dashboards** — no longer front-page.

### Delete or exclude from ranking

- **Water-confidence self-ratings as a scored domain.** A self-rating is
  self-reported by definition, and self-reported never touches a leaderboard.
  The skill checklist survives as personal preparation content, but **Zero
  Score for leaderboards is computed from verifiable performance events
  only.** This is the one place the old model and the new one genuinely
  conflict, and the leaderboard wins.
- **Behavioural domains (training consistency) in leaderboard scoring** —
  same reasoning. Consistency can gate achievements, not rank.
- Legacy four-category readiness engine — retired once Zero Score lands
  (stored history stays readable, per the dual-scale precedent).

---

## 2. What already exists for auth and profiles

- Supabase email/password auth with session persistence and an SSR-safe
  storage adapter; a boot gate routing signed-out → sign-in.
- `athlete_profiles` with RLS scoped to `auth.uid()` via
  `current_athlete_id()`; local-mode profiles migrate into an account on
  first sign-in.
- **Gap:** `displayName` is hardcoded to `'Athlete'` and nothing renders it.
  A ranking platform needs real handles: unique, changeable, moderated
  (leaderboards are a slur-delivery mechanism if not), plus a public/private
  visibility flag and a state (for state rankings). That is new work.
- **Gap:** every existing table is private-by-RLS. Leaderboards require
  *deliberate, minimal* public read surfaces that do not exist yet (§4).

---

## 3. Data model

New or reshaped entities. Names are Postgres tables unless noted.

```
pipelines                      -- app content, not a table (like targets today)
  id, name, branch, scoringConfigVersion → ScoringConfig (content, versioned)

candidate_profiles             -- the public half of an athlete
  id, user_id, handle (unique, moderated), pipeline_id,
  state_code nullable, visibility ('public'|'unlisted'),
  created_at

assessment_attempts            -- one sitting of a battery or single event
  id, candidate_id, pipeline_id, started_at, completed_at,
  kind ('battery'|'single'), verification_code nullable (server-issued)

event_results                  -- one performance inside an attempt
  id, attempt_id, candidate_id, event_id, value,
  verification_status ('self_reported'|'pending_review'|
                       'zero_verified'|'proctored'|'rejected'),
  verified_at nullable, verified_by nullable,
  recorded_at

evidence                       -- what backs a claim
  id, event_result_id, kind ('video'|'gps_track'|'sensor'|'health'),
  storage_path (private bucket), content_hash, duration_seconds,
  submitted_at
  -- immutable after submit; the hash is taken server-side at upload

zero_scores                    -- computed, never client-written
  id, candidate_id, pipeline_id, score (0–1000),
  category_scores jsonb, config_version, computed_at,
  freshness ('fresh'|'current'|'aging'|'expired')  -- derived, stored for query

ranking_snapshots              -- materialised leaderboards
  id, pipeline_id, scope ('national'|'state:XX'), captured_at,
  entries jsonb [{candidate_id, rank, score}]     -- or a rows table; see §4

ranking_history                -- one row per candidate per snapshot
  candidate_id, pipeline_id, scope, rank, score, captured_at

achievements                   -- definitions in app content; grants in DB
  achievement_grants: candidate_id, achievement_id, granted_at,
  source_event_result_id nullable

follows (later)                -- candidate_id → candidate_id, created_at

review_assignments (later)     -- community verification scaffolding
  event_result_id, reviewer_id, verdict_value, submitted_at
  -- consensus logic server-side; reviewer reputation derived
```

Existing tables `assessment_results`, `readiness_scores` etc. stay for
migration continuity; `assessment_results` rows become `event_results` with
`verification_status = 'self_reported'` (nothing an athlete has today is
verified, and saying so is the honest launch position).

---

## 4. Backend architecture and the trust boundary

This is the pivot's biggest structural change: **Zero Phase needs its first
server-side code.** Today every write is client → Postgres under RLS. A
credible leaderboard cannot work that way.

The rule that stops fraud at the architecture level:

> **Clients submit claims and evidence. Only the server issues verdicts,
> computes scores, and builds rankings.**

Concretely (Supabase Edge Functions + RLS):

1. **Clients can never write `verification_status` beyond
   `self_reported`.** RLS `with check` constraints pin the column on insert;
   status transitions happen only through Edge Functions running as service
   role. A hacked client can lie to itself, not to the leaderboard.
2. **Zero Scores are never client-computed.** The client may *preview* a
   score locally (same config, same engine) but the stored row is written by
   a `compute-zero-score` function reading only rows with a qualifying
   status. Client-side previews are labelled previews.
3. **Rankings are materialised server-side** on a schedule (and on score
   change), from `zero_scores` where freshness ≠ expired. Clients read a
   public *view* that exposes: handle, pipeline, state, rank, score,
   category scores — nothing else. Private-by-default athletes never enter
   the view.
4. **Evidence is immutable and content-addressed.** Uploaded to a private
   storage bucket; the server records a content hash at submit time; the
   verification code (a short random nonce issued by the server *before*
   recording, shown on camera) binds the video to the attempt. Re-used or
   pre-recorded footage fails the code check.
5. **Verification codes are single-use and expiring**, issued per attempt by
   an Edge Function, stored on the attempt row, never client-generated.
6. **Freshness expires rank, not history** (§10 of the brief): scores age
   out of ranking views on a policy timetable while remaining on the
   athlete's own profile as history. Policy constants live in the scoring
   config so tuning is not a schema change.
7. **Anomaly hooks from day one, enforcement later:** GPS tracks store raw
   points so pace/teleport checks can run retroactively; video duration must
   cover claimed reps × plausible cadence; rate limits per candidate per
   event per window. V1 records the signals; it does not need to adjudicate
   them automatically.

RLS posture: everything stays private by default. The *only* public read
surfaces are (a) the rankings view and (b) `candidate_profiles` where
`visibility = 'public'`. No public table ever contains precise location,
recruiter details, contact info, or application status — those fields simply
do not exist in the public half.

---

## 5. Zero Score: configurable by construction

The scoring engine is a generic interpreter; everything pipeline-specific is
data:

```ts
interface ScoringConfig {
  version: number;                 // stamped onto every computed score
  pipelineId: PipelineId;
  events: EventScoringRule[];      // which events count, per pipeline
  categories: CategoryRule[];      // event → category, category weights
  aggregation: { scale: 1000 };    // weighted categories → 0–1000
  freshnessDays: { fresh: 30; current: 90; aging: 180 };
}

interface EventScoringRule {
  eventId: AssessmentEventId;
  // Piecewise-linear anchors map raw performance → 0–1000 event points.
  // e.g. 1.5-mile: [ [780s, 0], [630s, 500], [510s, 900], [480s, 1000] ]
  anchors: ReadonlyArray<readonly [rawValue: number, points: number]>;
}
```

- The interpreter never contains a pipeline name or a magic number: same
  discipline as `calculateTargetReadiness` today, which this replaces.
- Configs ship as versioned app content *and* are mirrored server-side; the
  Edge Function and the client preview run the same JSON. Every stored score
  carries `config_version`, so retuning the curves is: publish config vN+1,
  recompute, and history stays interpretable — the exact
  `benchmark_version` pattern already in the codebase.
- Where a pipeline has a recognisable entry test the config mirrors its
  event list (clearly labelled as Zero Phase's model of it, per §19); where
  none exists, the config uses the Zero Phase standardized assessment and
  says so.
- Category sub-scores fall out of the same computation, so "why am I ranked
  here" (§2 of the brief) is the evidence screen pointed at new data.

---

## 6. Verification states, exactly

`self_reported` → counts for personal history, progress charts, and the
private view of the profile. Never enters rankings. UI: plain, no badge.

`pending_review` → evidence submitted, verdict not issued. Shows as pending;
still not ranked.

`zero_verified` → verdict issued by Zero Phase infrastructure (V1: continuous
video with on-camera code + human/ops review; later: GPS, sensors, health
integrations, CV). Ranked. UI: the badge, treated as prestigious.

`proctored` → verified in person by an approved evaluator (future). Ranked;
distinct badge.

`rejected` → evidence reviewed and failed. Kept (an audit trail, and repeat
rejections are themselves a signal), never displayed publicly.

The three-state model from the brief is these five, because pending and
rejected are unavoidable in any review pipeline.

---

## 7. Navigation

Five tabs per the brief, replacing the current five:

| Tab | V1 contents |
|---|---|
| **Home** | Zero Score gauge, national/state rank, movement, points-to-next-milestone, edge/weakness, countdown. |
| **Rankings** | Pipeline leaderboard; national/state/friends filters; tap-through to candidate profiles. |
| **Test** | Take verified assessment (battery or single event), previous attempts, verification statuses. Today's test-day flow is the seed. |
| **Community** | Staged: V1 ships the tab with following + activity of followed candidates only; combines/challenges later. If that is too thin at launch, fold into Rankings and add the tab at M5. |
| **Profile** | The candidate résumé: handle, pipeline, score, ranks, verified results, achievements, assessment + ranking history, settings. |

Training lives inside Home ("Improve your ranking") — no tab.

---

## 8. Brand rename mechanics (Phase 1 → Zero Phase)

- `src/config/branding.ts` is the single point for user-facing brand strings
  — this is exactly what it was built for. `productName: 'ZERO PHASE'`,
  wordmark split `ZERO` / `PHASE`, tagline `Train. Test. Prove it. Rank.`
- New terms are *product* vocabulary, not brand-file strings: Zero Score,
  Zero Verified, Zero Phase Rankings. They enter with the features that
  introduce them.
- `app.json` name/slug, README, docs headers: rename in the same commit.
- **Do not rename the local-storage prefix `phase1:` or programme/day id
  prefixes.** They are internal identifiers; renaming them destroys every
  existing device's data for zero user-visible benefit. Same for the repo
  path and Supabase project.
- Logo, typography identity, App Store assets: explicitly deferred per the
  brief.

---

## 9. Guardrails carried forward, and new ones

Carried forward unchanged: independent-platform disclaimers, never implying
official endorsement, no invented official standards, colour never the only
signal, human-readable errors, sentence-case voice.

New, because rankings raise the stakes:

- **Terminology (§19) enforced in code:** ranking copy is built by one
  formatter that always yields "…on Zero Phase" phrasing, and a test asserts
  ranking strings never claim official standing — the same pattern as the
  existing "descriptions never predict selection" test.
- **Privacy:** state is the finest public location granularity; public
  profiles are opt-in at handle creation; no DOB shown (age *group* only, if
  ever). The public tables structurally cannot leak what they do not store.
- **Minors:** candidates can be 17. Before launch, decide the minimum age
  and whether under-18 profiles can be public at all. Flagged as an open
  question, not silently decided.
- **Video evidence is sensitive:** private bucket, service-role access only,
  retention policy decided before community review ever sees a frame.

---

## 10. Roadmap

Each milestone ships runnable with gates green, per house rules. Brief's V1
priorities (§20) are covered by M0–M4.

- **M0 — Rebrand and reframe (small). *(complete)*** Branding file, app.json,
  docs, new tab skeleton with placeholder Rankings/Test/Community screens that
  say what is coming. Target → Pipeline rename in code (M0b). Nothing deleted
  yet.
- **M1 — Candidate identity. *(complete — awaiting owner review)*** Handle
  claim (unique, moderated wordlist), state, visibility; `candidate_profiles`
  table + migration 0006; profile screen reshaped into the résumé
  (self-reported data, clearly labelled).
- **M2 — Attempts and the score. *(complete — awaiting owner review)***
  `assessment_attempts` + `attempt_event_results` migration 0007; Test tab as
  the gateway (assessment vs practice, visibly distinct); versioned
  AssessmentDefinitions + ScoringConfig engine (pure, tested, piecewise-
  linear, banded) computing *estimated* ratings from complete self-reported
  attempts only. PJ IFT + SEAL PST + Ranger practice battery, all
  provisional and labelled so.

  **Core rule (owner decision, M2):** official ratings and rankings come
  from COMPLETE assessment attempts — one sitting, one protocol, every
  event. Never from best individual events combined across days; that
  performance never happened. Individual event results are training data,
  never leaderboard-eligible. An official rating always points back to one
  real, complete, verified attempt.
- **M3 — Verification (automated-first; design approved separately).**
  Server enters: Edge Functions for challenges, evidence upload (private
  storage, hashed), status transitions, server-side score compute — and
  automated verification as the target authority. Sequence per owner
  approval: M3A verification foundation *(complete — approved)*, M3B run
  engine in shadow + M3B.1 hardening *(complete — approved; shadow-only
  until promotion gates are satisfied, gates must not be relaxed)*, M3C
  pull-up prototype *(M3C-1 rep analyzer approved; M3C-2 real-video
  extraction + labeling complete — awaiting owner review; see
  docs/M3C-CALISTHENICS-DESIGN.md)*, M3D calisthenics productionization,
  M3E candidate continuity, M3F swim. Human review is ground truth/QA/appeals, not the
  product path. Standing launch gate: the physical-device end-to-end
  verification test. See docs/M3-VERIFICATION-DESIGN.md.
- **M4 — Rankings.** Materialised leaderboards + public views; Rankings tab
  (national/state/pipeline); rank on Home; ranking_history recording from
  day one so movement (§8) has data the moment there are two snapshots.
- **M5 — Retention loop.** Ranking movement UI, performance gap engine
  pointed at rank thresholds, freshness expiry live, first achievements
  (verified-performance-tied only), follows + community-lite.
- **M6 — Reach.** Share cards, more pipelines (CCT, SR, TACP, SWCC, SFAS),
  integration groundwork (HealthKit et al.), combine architecture.

The verification-before-rankings order (M3 before M4) is deliberate: a
leaderboard must never launch populated by unverified claims, even for a
day. An empty leaderboard with a credible path onto it beats a full one
nobody can trust.

---

## 11. Decisions (were open questions — answered by the owner)

1. **Handles, not real names.** Usernames are the primary public identity
   (e.g. @eJones); an optional display name may sit alongside. Real names are
   never required for public profiles.
2. **18+ only for V1.** No public profiles for minors. DOB, if collected for
   age verification, is stored privately and never displayed; age brackets
   (18–20, 21–24, 25–29, 30+) may be shown later, exact DOB never.
3. **State is self-declared**, selected at onboarding, used for state
   rankings and profiles only. No precise location is collected or shown.
   Stronger verification only if abuse demands it.
4. **Verification review is manual admin review for V1.** Submit → server
   validates → pending review → admin approves/rejects/adjusts → only
   approved performances are leaderboard-eligible. The data model leaves room
   for community reviewers, reputation, consensus, approved evaluators and CV
   later; none are V1. A simple internal admin review interface ships at M3.
5. **Evidence retention:** kept while the performance is leaderboard-active;
   lifecycle architected for a formal retention policy set before production
   launch. Users are told before submitting that footage is uploaded for
   review. Verification videos are never publicly viewable — only the
   resulting status and badge are public. Storage cost is treated as a
   first-order architectural concern.
6. **Training content is demoted, not deleted.** It becomes the Improve
   system connected to ranking weakness later. Legacy architecture does not
   get a vote on the new product's shape.
7. **Assessment and training records stay separate (M2 review).** An event
   performed inside a full assessment belongs to that assessment and never
   overwrites or creates a standalone training PR. The two are different
   contexts — later the UI may show TRAINING PB and ASSESSMENT PB side by
   side, distinguishably.
8. **Scoring curves are provisional (M2 review).** The shipped v1 curves are
   development/testing estimates, marked `provenance: 'provisional'` in every
   config, and are NOT production scoring standards. Real scoring models get
   researched, designed, validated and calibrated separately before public
   launch; nothing may make the provisional numbers hard to replace.
9. **Deletion policy for attempts (M2 review).** Candidates may delete
   attempts only while purely self-reported (already enforced by RLS). Once
   an attempt enters the verification lifecycle — submitted, verified,
   adjusted or rejected — it is not casually client-deletable; the audit
   trail is preserved. Privacy/deletion mechanisms come later without
   destroying verification integrity.
10. **Verification authority is AUTOMATED (supersedes the "manual admin
   review for V1" part of decision 4; M3 design review).** The production
   goal is 100% automated verification of normal assessments: evidence →
   automated analysis → server verification policy → authoritative verdict,
   with three outcomes (verified / failed / unable-to-verify) and mandatory
   abstention when confidence is insufficient. Human review remains for
   ground truth, appeals, QA, audits and fraud — never the normal path.
   Automated authority is granted per event behind measured gates (shadow
   mode first); false-verification rate is the metric everything else
   negotiates around. See docs/M3-VERIFICATION-DESIGN.md (v2).
11. **M3 execution decisions (roadmap approval).** (a) Zero Verified
   launches early with human ground truth as interim authority — automated
   engines run in shadow on every applicable assessment; do NOT market it
   as "AI verified" while a human is the authority. (b) Authority moves
   event-by-event via audited policy changes; demotion is immediate on
   degradation. (c) Verification consent and model-training consent are
   separate permissions — evidence is never silently training data.
   (d) Abstention is a feature: optimize leaderboard integrity, never
   completion rate. (e) Run first, calisthenics second (pull-ups →
   push-ups → sit-ups), swim last; nothing waits on swim automation.
   (f) Prefer established CV components and deterministic logic before any
   custom model training. (g) Disagreements between model and ground truth
   are preserved as first-class data. (h) M4 leaderboards only require an
   authoritative verified result — they do not care whether the authority
   at the time was human ground truth or a promoted engine. (i) Public
   language stays simple: UNVERIFIED / VERIFIED — no internal ML terms.
   Sequence: M3A foundation → M3B run engine → M3C pull-up prototype →
   M3D calisthenics productionization → M3E continuity → M3F swim, with a
   review stop after each.

**Naming:** the 0–1000 rating is NOT called Zero Score. Internal name
`performanceRating`; UI label "Performance rating" via `RATING_LABEL` in the
branding config — one place to change when the real name is chosen. Every
"Zero Score" reference earlier in this document should be read as
`performanceRating` until the final brand name lands.

## 12. Superseded questions (original list)

1. **Handles and real names** — handles only, or optional real names?
   (Recommend handles only at launch; less moderation surface.)
2. **Minimum age / minors' visibility** — legal and ethical call before any
   public profile ships.
3. **State source** — self-declared state, or verified via anything? (Self-
   declared is fine if the UI says so.)
4. **Manual review capacity** — M3's `zero_verified` means a human (you/us)
   reviews video at first. Acceptable at small scale; needs a queue cap.
5. **Video retention & cost** — Supabase storage bills by GB; continuous
   video of a 1.5-mile run is large. Policy: retain until verified + N days?
6. **The old training content** — demoted per this plan, but confirm nothing
   here (programmes, milestones, water skills) should be deleted outright.
