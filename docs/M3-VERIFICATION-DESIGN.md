# M3 — Automated Verification Architecture

**Status: DESIGN v2, FOR REVIEW. Nothing implemented.**
**v2 change: verification authority moves from human review to automated
verification.** Human review becomes a secondary process — ground truth,
appeals, QA, audits, fraud investigation — never the normal product path.

The question is unchanged:

> How confident can Zero Phase be that **this specific candidate** performed
> **this specific complete assessment**, at **this time**, according to the
> **required protocol**, without manipulating the evidence?

What changed is who answers it at scale. The target architecture:

```
EVIDENCE
   ↓
AUTOMATED ANALYSIS          (specialized engines, per event)
   ↓
SERVER VERIFICATION POLICY  (thresholds, integrity, versioned rules)
   ↓
AUTHORITATIVE VERDICT       (verified | failed | unable_to_verify)
```

The engineering goal, stated the honest way: **automate routine verification
at extremely high *measured* reliability while abstaining whenever evidence
or confidence is insufficient.** Not "perfect verification" — abstention is a
first-class outcome, and leaderboard credibility outranks verification
completion rate. `unable_to_verify` is always preferable to incorrectly
verified.

**M2 is untouched by this change.** One complete assessment produces one
rating; training events stay separate; self-reported never ranks; official
ratings are server-controlled; history is append-only; scoring configs are
versioned; a ranking always references one complete eligible assessment.

---

## 1. The three-outcome verdict model

Every event, and every assessment, resolves to exactly one of:

| Outcome | Meaning | Examples |
|---|---|---|
| **VERIFIED** | Sufficient evidence and confidence to accept the result. | All checks pass above calibrated thresholds. |
| **FAILED** | Sufficient evidence that the protocol or result is invalid. | Invalid rep standards, insufficient distance, wrong event order, excessive transition time, confirmed evidence manipulation. |
| **UNABLE_TO_VERIFY** | Evidence is ambiguous or technically insufficient. **The system abstains rather than guesses.** | Candidate leaves frame, landmarks untrackable, severe lighting, swimmer lost by the tracker, GPS quality too poor, angle prevents ROM judgment, corrupt file. |

Rules that follow from this:

- The system is **never forced to guess**. Any engine that cannot reach its
  confidence threshold returns `unable_to_verify` with reasons.
- `FAILED` requires positive evidence of invalidity — it is a finding, not a
  default. Ambiguity is `unable_to_verify`, not failure.
- `unable_to_verify` is a candidate-friendly outcome: clear reasons
  ("Pull-up footage could not be reliably evaluated — camera too low"), no
  penalty, retest path. The pre-capture quality gate (§5) exists to make it
  rare.
- Assessment-level verdict composes event verdicts (§3): all events verified
  → verified; any failed → failed; otherwise unable_to_verify.

---

## 2. Architecture: specialized engines, not one AI reviewer

There is deliberately **no generic "AI reviewer"** and no opaque model that
writes `verified = true`. Verification is a pipeline of specialized systems,
each producing structured, signed-off analysis; a deterministic **rules
engine** applies versioned policy to their outputs; the **server** issues the
verdict. A model returns observations; only policy decides.

```
                    ┌───────────────────────────────┐
 evidence  ───────► │ 1 EVIDENCE INTEGRITY ENGINE   │  deterministic
                    ├───────────────────────────────┤
                    │ 2 EVENT ANALYSIS ENGINES      │
                    │   · calisthenics (pose/CV)    │  per-event,
                    │   · run (sensor physics)      │  specialized
                    │   · swim (tracking/CV)        │
                    ├───────────────────────────────┤
                    │ 3 CANDIDATE CONTINUITY ENGINE │  session-scoped
                    ├───────────────────────────────┤
                    │ 4 FRAUD / ANOMALY ENGINE      │  cross-signal
                    ├───────────────────────────────┤
                    │ 5 VERIFICATION RULES ENGINE   │  deterministic,
                    │   (server policy, versioned)  │  issues verdict
                    └───────────────────────────────┘
```

**Evidence Integrity Engine** (deterministic, no ML): in-app capture flag,
challenge/session binding, hash match vs commitment, capture continuity,
expected clip duration vs server event window, metadata sanity, event order,
transition timing vs protocol budget, global evidence-reuse check, session
state validity. Runs first; hard failures short-circuit the pipeline.

**Calisthenics Analysis Engine** (§6): body visibility, pose landmarks,
temporal movement analysis, exercise-specific state machines, rep
segmentation, per-rep validity + ROM evaluation, per-rep and per-event
confidence.

**Run Verification Engine** (§7): GPS distance/accuracy/continuity, elapsed
time, teleportation and speed/acceleration plausibility, elevation sanity,
app/device state, motion data where available, start/finish bookends.
Physics and rules first — auditable; ML only as an anomaly classifier on top.

**Swim Verification Engine** (§8): candidate tracking, lane tracking,
wall-touch and turn detection, lap counting, elapsed time, continuity, pool
framing and stated-length evidence, confidence. Abstains readily.

**Candidate Continuity Engine**: answers one narrow question — *does the
person in each event appear consistent with the person established in this
session's identity clip?* Session-scoped comparison only. This is
deliberately **not** a public identity-recognition system and never becomes a
cross-user biometric database: embeddings are computed per session, compared
within the session, and are never indexed across candidates.

**Fraud / Anomaly Engine**: combines signals across engines — integrity
oddities + implausible improvement vs history + device fingerprints +
continuity wobble — into risk flags. High-risk flags block auto-verification
(→ unable_to_verify or investigation), never silently pass.

**Verification Rules Engine**: deterministic, versioned server policy that
consumes every engine's structured output and produces the verdict.
Conceptually:

```
auto_verify(event) ⇐
      integrity = pass
  AND candidate_continuity ≥ threshold(event, policy_version)
  AND analysis_confidence  ≥ threshold(event, policy_version)
  AND capture_quality      ≥ threshold(event, policy_version)
  AND no high-risk anomaly flag
otherwise → unable_to_verify   (or failed, on positive invalidity findings)
```

---

## 3. Automated-verdict state machine

Attempt statuses are unchanged from M2. What changes is what happens inside
`pending_review` — it becomes, in the normal path, machine time measured in
minutes, not reviewer-queue time measured in days.

```
ATTEMPT
self_reported ──(verified session submit)──► pending_review
                                                │
                              ┌─────────────────┼──────────────────┐
                              ▼                 ▼                  ▼
                        zero_verified        rejected        unable_to_verify*
                        (official rating)    (failed:         (reasons + free
                                             reason codes)     retest path)

EVENT (inside analysis)
captured ─► integrity_checked ─► analyzed ─► verified | failed | unable_to_verify

ASSESSMENT VERDICT = compose(event verdicts):
  all verified                        → zero_verified
  any failed                          → rejected(reason)
  none failed, any unable_to_verify   → unable_to_verify
```

\* Storage note: `unable_to_verify` is recorded as the analysis outcome; at
the attempt-status level it maps onto `rejected` with reason class
`unable_to_verify` / `retest_required` — the M2 enum needs no migration, and
the UI renders it as its own friendly outcome, never as an accusation.

**Authority is a policy switch, not an architecture** (§10): the same
pipeline runs in shadow mode (analysis recorded, humans hold authority) or
authority mode (analysis verdict is final), configured per event and per
policy version. Promotion from shadow to authority is an explicit, audited
configuration change gated on measured performance.

Every transition remains a **service-role write**. Nothing here weakens the
M2 rule that clients cannot touch verdicts.

---

## 4. Machine outputs: structured, traceable, rep-level

### Event-level output (every engine, every event)

```
event: pull_ups
claimed_value: 21
detected_reps: 22
accepted_reps: 20
invalid_reps:
  - rep 8:  chin_below_bar
  - rep 17: incomplete_extension
body_visibility_confidence: 0.995
rep_count_confidence:       0.987
rom_confidence:             0.974
candidate_continuity:       0.991
evidence_integrity: pass
anomaly_flags: []
decision: VERIFIED
accepted_value: 20
```

The accepted number must be **traceable to machine observations** — an
engine that returns "looks good" is not an engine, and no such output is
accepted by the rules engine.

### Rep-level records (calisthenics)

Every detected repetition persists:

```
rep_number · start_ts · end_ts · verdict (valid|invalid|uncertain)
confidence · reason_codes[] · joint/body metrics (per-rep extremes:
e.g. min elbow angle, chin-vs-bar clearance, hip line deviation)
```

This powers debugging, appeals, model evaluation, future visual replay, and
candidate transparency — eventually `CLAIMED 21 · ACCEPTED 20 · REP 14
INVALID — incomplete extension` with no human annotator involved.

---

## 5. Pre-capture quality gate

Automated verification starts **before** the exercise does. Ahead of each
camera event, an on-device preflight checks: full body visible, required
landmarks visible, required equipment (bar) visible, camera angle in range,
lighting adequate, camera stable, distance adequate. If the system could not
confidently judge the event from this setup, **the verified event does not
start**, and the candidate is told exactly what to fix, in plain commands:

```
MOVE CAMERA BACK · FEET NOT VISIBLE · BAR NOT FULLY VISIBLE
LIGHTING TOO LOW · CAMERA TOO LOW · PHONE NOT STABLE
```

This is the single biggest lever on automated accuracy and on keeping the
`unable_to_verify` rate low: reject bad setups when fixing them costs ten
seconds, not after a max-effort set. M3 may begin with basic heuristics
(single pose-frame checks, brightness, gyro stability) — but the gate is
architected in from the first build and its checks version with the
analysis ruleset.

On-device vs server trust: the preflight runs on-device for instant feedback
and **gates capture only**. Authoritative analysis always runs server-side
against the committed evidence — on-device outputs are conveniences and
claims, never inputs to the verdict.

---

## 6. Calisthenics: pose/motion analysis, not an LLM watching video

The pipeline is computer vision, purpose-built: pose estimation → landmark
tracking → temporal smoothing → an **exercise-specific state machine** →
rep segmentation → per-rep ROM evaluation against the protocol standard.

```
PULL-UP:  dead-hang bottom → upward motion → chin clears bar reference
          → downward motion → required extension → next rep
PUSH-UP:  locked top → controlled descent → required bottom threshold
          → return to locked top → next rep
SIT-UP:   start position → required upward position → return → next rep
```

- Standards are **versioned with the assessment protocol**: the state
  machine's thresholds (what "chin clears", "required extension", "bottom
  threshold" mean) are data tied to `definition_id@version` +
  `analysis_ruleset_version`, not constants in analysis code. A protocol
  change is a new ruleset version, and historical attempts keep the rules
  they were judged under.
- Per-rep verdicts carry `uncertain` as a real value; too many uncertain
  reps pushes the event to `unable_to_verify` rather than rounding them
  either direction.
- Base pose models are established components (on the order of
  MediaPipe/MoveNet-class body-landmark models); Zero Phase's proprietary
  layer is the exercise state machines, standards evaluation, calibration
  and validation harness on top — not training pose estimation from scratch.

## 7. Run: sensor physics first, ML second

Primarily **objective sensor verification** — auditable rules over the GPS
trace, not visual AI: computed distance (accuracy-weighted, filtered),
elapsed time from trace timestamps, route continuity, teleport detection,
speed/acceleration plausibility, elevation sanity, app-state and clock-skew
checks, motion-sensor corroboration where available, bookend clips checked
for challenge + continuity. ML appears only as an anomaly classifier over
trace features (spoof-likeness), and its flags route to `unable_to_verify`
or fraud review — the physics rules stay primary and explainable.

Claimed distance/time is **never authoritative**: accepted values are
computed from evidence (time read at the accepted distance), claim stored
verbatim beside them. Treadmills remain ineligible in V1. Because this
engine is deterministic and was already designed server-side in v1, **the
run is the first event that can realistically reach full automated
authority.**

## 8. Swim: strictest environment, fastest abstention

Still the hardest event, now with requirements chosen for **machine**
judgeability, not just reviewer judgeability: fixed elevated camera, full
lane visible including walls/turns, pool markers visible, pool length
selected/stated before start, candidate identified on camera before entering
the water, continuous recording.

Automated targets: swimmer tracking in-lane, wall-touch detection, turn
detection, lap counting, elapsed time, continuity. The abstention rule is
strict: **if tracking confidence drops below threshold at any point, the
event is `unable_to_verify` — the system never guesses lap counts.**

It is acceptable, and expected, that the swim (a) has stricter environment
requirements than calisthenics, (b) shows a higher `unable_to_verify` rate,
and (c) reaches automated authority last — possibly remaining
shadow/assisted long after pull-ups are fully automated. Pool length remains
unprovable by camera alone; the stated length + visible markers + pace
plausibility bound it, and the proctored tier remains the strong answer.

---

## 9. AI/ML data schema

New records, alongside (never replacing) the v1 session/evidence tables:

```sql
verification_analysis_runs (
  id, attempt_id, session_id,
  trigger ('submission','reprocess','adversarial_test','shadow'),
  policy_version,                 -- verification policy applied
  status ('running','complete','error'),
  verdict ('verified','failed','unable_to_verify') null,
  started_at, completed_at
)

analysis_events (
  id, run_id, event_id,
  engine, model_name, model_version, ruleset_version,
  claimed_value, detected_value, accepted_value,
  verdict ('verified','failed','unable_to_verify','uncertain'),
  confidences jsonb,              -- named: visibility, count, rom, continuity…
  reason_codes text[],
  metrics jsonb,                  -- engine-specific structured observations
  created_at
)

analysis_reps (
  id, analysis_event_id, rep_number,
  start_ms, end_ms,
  verdict ('valid','invalid','uncertain'),
  confidence, reason_codes text[],
  metrics jsonb                   -- per-rep joint/body extremes
)

analysis_signals (                -- cross-engine inputs to policy
  id, run_id, source_engine, signal, value jsonb, created_at
)

analysis_flags (                  -- anomaly/fraud findings
  id, run_id, severity ('info','suspicious','high_risk'),
  code, detail jsonb, created_at
)

verification_policies (           -- versioned thresholds & authority
  version, definition_id, definition_version,
  thresholds jsonb,               -- per event, per confidence dimension
  authority jsonb,                -- per event: 'shadow' | 'authoritative'
  created_at, activated_at, notes
)
```

All analysis tables are **service-role only**. Candidates see a sanitized
projection (verdict, accepted values, human-readable reasons); the raw
signals never leave the backend. Human review rows
(`verification_event_reviews`, v1 design) are retained with a `reviewer_kind`
distinction (`human` | `system`) — in shadow mode both exist and
disagreement between them is queryable by design.

## 10. Model versioning & reprocessing

Every automated decision records the full stack that produced it:

```
MODEL · MODEL VERSION · RULESET VERSION ·
ASSESSMENT PROTOCOL VERSION · VERIFICATION POLICY VERSION
```

- Historical assessments stay auditable forever: we can always answer
  "which model, under which rules, verified this 826 in March?"
- A newer model **never silently reinterprets** old verified performances.
  Reprocessing historical evidence is an explicit, audited operation
  (`trigger = 'reprocess'`, its own run row, its own audit entry), and
  policy decides separately whether a reprocessed verdict ever replaces the
  original.
- This mirrors M2's scoring-config discipline exactly — same reasoning,
  same mechanics, one level up.

## 11. Confidence and calibration

Confidence numbers are only meaningful if they are **calibrated** —
thresholds come from validation data, never intuition:

- Every engine emits named confidence dimensions (visibility, count, ROM,
  continuity, tracking). Thresholds live in `verification_policies`, per
  event and per dimension, versioned.
- Calibration quality is itself measured (§13): when the model says 0.97,
  it must be right ~97% of the time on held-out data, or the threshold
  moves until behavior matches.
- The initial thresholds ship deliberately conservative: a high
  `unable_to_verify` rate at launch is the designed cost of a near-zero
  false-verification rate, and thresholds relax only as validation data
  earns it.

## 12. Validation dataset & ground truth

The verifier is not trusted because it works on a few test videos. An
offline validation system is part of the architecture:

- A labeled corpus with **human-established ground truth per rep and per
  event**, deliberately spanning: valid/invalid/borderline reps, body
  types, clothing, gyms, bar styles, phone models, lighting, camera
  distances, movement speeds, fatigue-degraded form, deliberate cheating
  attempts, partial obstruction, unusual-but-valid technique.
- Ground truth is produced in the review console (v1's console, repurposed:
  its primary job is now **labeling and QA**, not production verdicts) with
  a defined labeling standard and double-labeling on a sample to measure
  human agreement itself — ground truth has error bars too.
- Dataset governance: training/validation use of candidate footage requires
  **its own explicit consent**, separate from verification consent (§17).
  Early corpus can be seeded by us and volunteers before any candidate
  footage is used.
- Held-out splits are sacred: no threshold tuning on the evaluation set.

## 13. Metrics that matter

Per event, not "accuracy":

| Metric | Question |
|---|---|
| **False verification rate** | **How often do we verify what should not have been verified? The metric. Optimized against aggressively; everything else negotiates around it.** |
| False rejection rate | How often is a legitimate performance failed? |
| Unable-to-verify rate | How often do we abstain? (Acceptable cost — but tracked, because it is the UX price.) |
| Valid-rep precision / recall | Per-rep judgment quality. |
| Invalid-rep detection rate | Do we catch the bad reps specifically? |
| Exact count agreement + error distribution | Not just averages — the shape of miscounts. |
| Calibration quality | Do confidences mean what they say? |

A higher unable-to-verify rate is an acceptable trade for a substantially
lower false-verification rate — leaderboard integrity over completion rate,
as policy, in writing.

## 14. Shadow mode → authority: the promotion path

```
candidate submits ──► pipeline analyzes (always)
                          │
             ┌────────────┴────────────┐
        SHADOW MODE                AUTHORITY MODE
        human ground-truth         pipeline verdict is final;
        review issues the          humans audit samples,
        verdict; AI verdict        handle appeals & flags
        recorded + compared
```

- Both modes run the **same pipeline and record the same analysis rows**;
  the only difference is which verdict is authoritative — a
  `verification_policies.authority` setting, per event.
- Disagreements in shadow mode are first-class data: stored, queried,
  reviewed, fed back into rulesets and thresholds.
- **Promotion gates** (numbers set later, philosophy fixed now): an event's
  engine gains authority only after hitting explicit targets on
  (1) held-out validation data, (2) the adversarial suite (§15), and
  (3) real-world shadow-mode assessments. Promotion is per event — pull-ups
  may be fully automated while the swim is still shadowed. Demotion is the
  same switch in reverse if live metrics degrade.
- During shadow mode, humans hold interim authority for camera events —
  which is not wasted work: every review is a labeled ground-truth sample.

## 15. Adversarial testing

A dedicated, maintained suite of hostile assessments, each with a known
correct outcome, run against every model/ruleset/policy release:

partial reps · camera-angle manipulation · leaving frame · a second person
entering frame · prerecorded displays / video-of-video playback ·
speed-modified footage · mirrored footage · GPS spoof-like traces ·
intentional GPS dropouts · shortened routes · hidden extra rest · fake pool
lengths · skipped laps · multiple people in a lane.

Results are documented per attack as **PREVENTED / DETECTED /
UNABLE_TO_VERIFY / NOT CURRENTLY SOLVED** — the fourth category is required
reporting, not an embarrassment to hide. The suite is a release gate: a
regression on a previously-passed attack blocks promotion.

## 16. What v1 keeps (session architecture is not replaced by AI)

Everything provenance-related from design v1 stands unchanged — AI analyzes
evidence; the session architecture is what makes the evidence *worth
analyzing*:

- Server-generated single-use expiring challenges, burned into every clip
  with event ordinals; identity clip opening each session.
- In-app capture as the Zero Verified boundary (no camera-roll uploads).
- Server-controlled event ordering, server-clocked windows and transition
  budgets, append-only timeline.
- Hash-at-capture commitments; global evidence-reuse prevention; resumable
  uploads; private bucket; signed-URL access only.
- The failure/recovery experience (local-first capture, clean interruption,
  abort-anytime, technical failure → fair retest, never verification).
- The trust boundary: client submits claims and evidence; server determines
  truth. Models are now part of *analysis*; they still cannot touch the
  verdict — only server policy can (§2, §17).
- Verification tiers (self-reported → zero-verified → proctor → org) and
  attestation architecture; storage/cost analysis — with one big update:
  automated review removes the 200–300 reviewer-hours per 1,000 assessments
  that was v1's real scale constraint, replacing it with GPU inference cost
  (bounded, per-assessment, and cheap relative to labor) plus a small
  residual human load for audits/appeals/labeling.

## 17. Privacy (additions for automation)

- **Minimum necessary analysis.** Engines compute what the event requires —
  landmarks, tracks, traces. No general-purpose biometric identity
  database; continuity embeddings are session-scoped and never indexed
  across users (§2).
- Evidence storage rules unchanged: private by default, never reachable
  from profile APIs, retention per the standing owner decision.
- **Training-data consent is separate from verification consent.** Ordinary
  verification permission covers analysis of your footage to verify *your*
  assessment. Using footage to train or evaluate models is a distinct,
  explicit opt-in with its own policy — designed in now, before any corpus
  of candidate footage exists.
- Candidates see outcomes and reasons, not surveillance theater: the UX
  never exposes raw signals, embeddings, or model internals.

## 18. Product UX

The backend sophistication is invisible. The candidate experiences:

```
TAKE VERIFIED IFT
   ↓
CAMERA CHECK          ✓ Body visible  ✓ Camera stable  ✓ Lighting good
   ↓
PERFORM ASSESSMENT    (events in order, transitions timed)
   ↓
ANALYZING PERFORMANCE
   ↓
VERIFIED ✓                         — or —    UNABLE TO VERIFY
Performance rating: 846                      Pull-up footage could not be
                                             reliably evaluated.
                                             Retest available now.
```

Failure copy explains what to fix, never accuses. Appeals (§19 of v1,
retained): a candidate who believes the accepted value is wrong can REQUEST
REVIEW — which routes to human review as the exception path. Appeals are
architected now, shipped later; their existence does not make verification
human-driven.

---

## 19. Build plan: honest capability assessment + milestones

### Realistically buildable now (no ML research required)

- Session/challenge/capture/hash/timeline architecture (v1 design, intact).
- **Evidence Integrity Engine — 100% deterministic, fully automatable
  immediately.**
- **Run Verification Engine — physics/rules over GPS; the first event with
  a credible path to full automated authority in M3.**
- Verification Rules Engine, three-outcome verdicts, policy versioning,
  shadow/authority switch, analysis record schema.
- Pre-capture quality gate v1 (heuristics: brightness, gyro stability,
  single-frame pose sanity via an off-the-shelf on-device pose model).
- Review console repurposed as ground-truth labeling + QA + shadow
  comparison tooling.

### Requires ML/CV engineering + validation before authority

- Calisthenics rep judging (pose pipeline + exercise state machines are
  buildable with established components; **calibrated trust** requires the
  dataset, metrics and shadow-mode mileage — the work is validation more
  than modeling).
- Candidate continuity scoring (session-scoped embedding comparison).
- Swim tracking/lap counting (hardest; strictest environment; last to
  authority).
- Fraud/anomaly ML layers (rules-first versions ship early; learned
  versions need data only production can generate).

### Proposed milestones

- **M3A — Verified sessions + deterministic verification core.**
  Sessions, challenges, in-app capture for all events, hashes, timeline,
  private evidence storage. Evidence Integrity Engine + Rules Engine +
  three-outcome verdicts + policy/authority config + full analysis schema.
  Run engine live in shadow mode. Camera events: capture works end-to-end;
  interim authority is human ground-truth review through the relabeled
  console (every review doubles as a training label). Candidate UX already
  shows the automated flow shape.
- **M3B — Calisthenics analysis v1 + quality gate.** Server-side pose
  extraction, exercise state machines for pull-ups/push-ups/sit-ups,
  rep-level records, preflight camera gate, shadow-mode comparison
  dashboards, labeling standard + dataset tooling, metrics suite (§13),
  adversarial suite v1. Run engine promoted to authority when its gates
  pass.
- **M3C — Calibration + first camera-event authority.** Threshold
  calibration from validation data, adversarial hardening, per-event
  promotion of calisthenics engines as each clears its gates
  (pull-ups first, likely). Candidate continuity engine v1. Appeals
  skeleton.
- **M3D — Swim automation.** Tracking, wall-touch/turn/lap detection under
  the strict environment gate; long shadow period expected; promoted only
  when measured. Until then the swim runs shadow with human ground truth —
  or, at the owner's option, waits on the proctored tier.

Throughout: the long-term goal is fixed — **100% of normal assessment
reviewing automated** — and every milestone moves authority event-by-event
behind measured gates rather than betting the leaderboard on a launch-day
model.

---

## 20. Open questions for the owner

1. **Shadow-mode interim experience:** while camera events await promotion,
   human ground-truth review is the interim authority — meaning early
   verified assessments do wait on a person. Accept that (it also builds
   the dataset), or hold Zero Verified launch until the run + calisthenics
   engines pass their gates?
2. **Training-data consent placement:** opt-in at session time, at account
   level, or via a separate contributor program?
3. **Inference infrastructure:** server-side GPU (managed inference) is the
   trustworthy default; approve that direction now or revisit at M3B when
   the pose pipeline lands?
4. **Promotion gate numbers:** targets per event (false-verification rate
   ceilings, shadow sample sizes) — proposed concretely at M3B when the
   metrics suite exists, decided by you.
