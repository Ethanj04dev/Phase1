# M3C — Automated Calisthenics Verification (Pull-ups first)

**Status: DESIGN APPROVED with owner decisions below. Implementation
begins at M3C-1 after scope sign-off.**

## Owner decisions (M3C review — binding)

1. **Kipping stays conservative in v1:** detected swing flags the rep and
   resolves to UNCERTAIN when confidence or calibration is insufficient;
   no automatic invalidation until labeled real-world data supports a
   calibrated threshold. Ruleset/version-controlled so different protocols
   can define different standards later.
2. **Setup-photo gate approved,** including ~5–10s of pre-assessment
   friction — with the UX requirement that the check visibly communicates
   what is being verified (framing, body visibility, bar visibility,
   lighting, stability), never an unexplained spinner.
3. **Server worker stays at M3C-5.** The analyzer is validated before
   authoritative execution is productionized.
4. **Bar reference is an interface, not an assumption.** Wrist-derived bar
   height is acceptable for the prototype, but the analyzer consumes a
   replaceable `BarReference` and does not care how it was obtained;
   future independent bar detection plugs in without rewriting the engine.
5. **The §7 thresholds are prototype/shadow gates, not production-authority
   standards.** A separate authoritative-promotion stage requires
   substantially stronger real-world evidence, targets near-zero false
   verification, and its final thresholds are empirically calibrated,
   never arbitrarily chosen.
6. **Dataset diversity is measured at the athlete/session level,** not
   video count — many clips from few athletes must never masquerade as
   diversity.
7. **The fundamental architecture is preserved:** pose estimation
   observes; deterministic versioned rules decide; no ML/CV component ever
   directly issues an authoritative VERIFIED verdict.

The Run Engine's philosophy, applied to camera events: deterministic
measurement wherever possible, ML used to *observe* rather than to issue
verdicts, explicit uncertainty with mandatory abstention, immutable
evidence, server-side authoritative analysis, versioned models and rules,
adversarial testing, shadow-mode validation, and numeric promotion gates.

The critical architectural insight — and the whole design follows from it:

> **Pose estimation is the sensor. The rep analyzer is the engine.**

A pose model turns video into body-landmark streams; that is its entire
job, and it is an established component we version and swap, never train
from scratch. Everything Zero Phase actually decides — what a rep is,
whether the chin cleared the bar, whether extension was reached, whether
the evidence supports a count at all — is a **deterministic state machine
over landmark streams**: pure TypeScript, exhaustively testable, ruleset-
versioned, exactly like the Run Engine over GPS samples. No multimodal
model ever "watches a video and decides."

---

## 1. Pipeline

```
VIDEO EVIDENCE (immutable, hashed, in the private bucket — M3A)
   ↓
EXTRACTOR                 pose model → landmark stream artifact
   ↓                      (established component, version-pinned)
LANDMARK STREAM           derived artifact, stored BESIDE evidence
   ↓
REP ANALYZER              deterministic: state machine → rep segmentation
   ↓                      → per-rep ROM judgment → per-rep verdicts
STRUCTURED ANALYSIS       counts, rep records, confidences, reasons
   ↓
SERVER VERIFICATION POLICY (versioned; shadow until promoted)
   ↓
EVENT VERDICT             verified | failed | unable_to_verify
```

- **The extractor** (v1: MediaPipe Pose Landmarker-class, 33 landmarks with
  per-landmark visibility scores) is chosen for maturity, upper-body detail
  (mouth/nose landmarks for the chin line, wrists/elbows/shoulders for the
  hang), and availability in both browser JS and server runtimes — the same
  extractor family runs in the console during shadow development and in the
  server worker on the promotion path. Its name and version stamp every
  analysis row. Custom training or fine-tuning happens only if the measured
  data proves the established component insufficient (M3 rule 11).
- **The landmark stream** is a derived artifact: per-frame timestamps,
  normalized landmark positions, visibility scores, extractor version, and
  the source evidence id + hash. Stored in the private bucket beside the
  video (~1–2 MB for a 2-minute clip). The raw video is never modified or
  replaced; streams can always be re-extracted from it by a newer extractor
  as an explicit, audited reprocess.
- **The rep analyzer** is dependency-free pure TS in
  `src/domain/calisthenicsEngine/`, synced byte-for-byte to the server
  exactly as the Run Engine is (`scripts/sync-*` + parity test).

## 2. The pull-up state machine (ruleset v1, versioned with the protocol)

Landmarks used: wrists, elbows, shoulders, mouth/nose (chin proxy), hips,
knees, ankles. Derived per frame: elbow angle (shoulder–elbow–wrist), chin
line vs bar line, hip horizontal displacement, per-landmark visibility.

**Bar reference (interface, per owner decision 4):** the analyzer consumes
a `BarReference` — bar line position in image space, its uncertainty, and
the provider's name and version — and never cares how it was obtained.

```
interface BarReference {
  provider: string;          // 'wrist_hang_median' | future detectors
  providerVersion: string;
  lineY: number;             // normalized image space
  uncertainty: number;       // spread of the estimate
}
```

The v1 provider is deterministic wrist-hang estimation: the median wrist
height across dead-hang frames, with its spread as the uncertainty — the
hands are on the bar, so the wrists *are* the bar, and no object detection
is needed to prototype. A future independent bar detector replaces the
provider without touching the rep engine, and every analysis records which
provider produced its reference.

```
DEAD_HANG      elbow angle ≥ extensionAngle (default 160°), stable
   ↓ ascent    chin line rising toward bar line
TOP            chin above bar line by ≥ clearanceMargin  → else no rep
   ↓ descent
RETURN         elbow angle ≥ extensionAngle again        → rep complete
   ↓
DEAD_HANG      … next rep
```

Every threshold — extension angle, clearance margin, minimum hang
stability, maximum hip-swing amplitude — lives in a versioned
`CALISTHENICS_RULESET` keyed to the assessment protocol version, mirroring
`RUN_RULESET`. A protocol change is a new ruleset version; historical
analyses keep the rules they were judged under.

**Per-rep record** (the `analysis_reps` schema from M3A, now populated):
rep number, start/end timestamps, verdict `valid | invalid | uncertain`,
reason codes (`chin_below_bar`, `incomplete_extension`,
`landmarks_occluded`, `excessive_swing`, `left_frame`), confidence, and
per-rep metrics (min elbow angle at lockout, chin–bar clearance in
normalized units, hip-swing amplitude, mean landmark visibility).

**Kipping:** measured (hip oscillation amplitude/frequency) and flagged
from day one; whether excessive swing *invalidates* a rep is a protocol
question. Conservative v1 default: flag + mark the rep `uncertain`, never
auto-invalidate, until real labeled data calibrates the threshold.

## 3. Uncertainty and abstention

Three-outcome discipline at both rep and event level:

- **Rep-level:** low landmark visibility through a rep, chin/bar separation
  inside the clearance uncertainty, or occlusion → the rep is `uncertain`,
  never rounded in either direction.
- **Counting rule (conservative):** `acceptedReps = valid reps only`.
  Uncertain reps are not credited — and if uncertain reps exceed a ruleset
  fraction (default 15%) or visibility collapses at any point, the whole
  event is `unable_to_verify` with reasons ("camera could not judge reps
  9–12"). Failure requires positive evidence (e.g., a full set of clearly
  judged reps below the claim by more than the uncertain count).
- **Event confidences** (deterministic formulas, ruleset-governed):
  `landmarkVisibility`, `framing` (full body + bar in frame throughout),
  `repJudgment` (fraction of reps judged confidently), feeding the same
  policy shape the Run Engine uses.
- Claimed vs detected vs accepted stays fully separated:
  `CLAIMED 21 · DETECTED 22 · ACCEPTED 20 — rep 8 chin below bar, rep 17
  incomplete extension`, traceable to per-rep records with timestamps —
  eventually shown to the candidate with no human annotator involved.

## 4. Camera quality gate (the accuracy lever)

Verification starts before the first rep. Two stages:

- **M3C v1 — setup-photo check:** at event setup the app captures one
  still frame, uploads it (~100 KB, seconds), and a server check runs the
  pose extractor on that single frame: full body visible, wrists (bar
  grip) in frame, adequate landmark visibility, frame brightness, phone
  stability (gyro). The verified event cannot open until the gate passes;
  the setup frame is retained as evidence context. Single-frame inference
  is cheap enough for Edge-class compute, so this ships without the full
  worker.

  **Candidate UX (per owner decision 2):** the check renders as a visible
  checklist resolving item by item — never an unexplained spinner:

  ```
  CAMERA CHECK
  ✓ Whole body visible
  ✓ Bar visible
  ✓ Lighting good
  ✓ Phone stable
  ● Checking framing…
  ```

  A failed item turns into its fix as a plain command — `MOVE CAMERA
  BACK · FEET NOT VISIBLE · BAR NOT FULLY VISIBLE · TOO DARK` — and the
  candidate retakes the setup shot. Pass or fix, the candidate always
  knows exactly what was checked and why.
- **Dev-build path — live gating:** continuous on-device pose preflight
  (impossible in Expo Go; the capture screen keeps the guided framing
  overlay there). Recorded either way: the gate result and its version
  land in the analysis metadata.

## 5. Server-side authority, shadow-first execution

Identical to the Run Engine's promotion path, decided up front:

- **Shadow development (M3C):** the extractor runs in the **review
  console's browser** against the committed evidence video (same bytes a
  server would read — the download already flows through signed URLs).
  The analyzer runs on the extracted stream; results are recorded through
  `record_shadow_analysis` (engine `calisthenics_pose`, which the policy
  gate already refuses to accept for any promoted engine). Reviewers see
  the machine's count and per-rep opinions beside their own ground truth;
  every disagreement is queryable via `shadow_disagreements`.
- **Promotion path:** a containerized analysis worker (queue-polling,
  service-role) downloads evidence, extracts, analyzes, writes system
  rows — the only execution that can ever hold authority. The analyzer it
  runs is parity-pinned to the benchmarked source. Console-side and any
  client-side extraction remain measurement forever.
- Compute cost: pose extraction runs near realtime on CPU — a 2-minute
  clip costs roughly a CPU-minute; three calisthenics events per
  assessment ≈ cents. Landmark artifacts add ~2 MB/event.

## 6. Datasets, ground truth, benchmark

- **Synthetic landmark streams first** — the analyzer's equivalent of
  `testTraces`: generated trajectories for clean reps, partial ROM, missed
  lockouts, chin-short reps, kipping, occlusion windows, frame exits,
  noise on landmarks, slow/fast cadence. These exhaustively test the state
  machine before any video exists, exactly as synthetic GPS traces did.
- **Real corpus:** the console's labeling mode (per-rep annotation:
  valid/invalid/uncertain + reason at timestamp) produces ground truth
  from every shadow review; a seed corpus is self-recorded across the
  diversity axes in M3 §12 (bodies, bars, gyms, phones, lighting,
  clothing, fatigue, deliberate cheating). Double-labeling on a sample
  measures human agreement itself.
- **Benchmark harness** mirrors the Run Engine's: fixtures of
  landmark-stream + per-rep ground truth, metrics computed on every test
  run, report regenerated into `docs/benchmarks/calisthenics-v1.md`.
  Extraction quality itself is benchmarked separately (extractor version A
  vs B on the same videos) so sensor and engine regressions never blur.

## 7. Metrics and gates — two stages, per owner decision 5

Versioned in `calisthenicsEngine/promotionGates.ts`, same shape as the run
gates. **Event-level false credit — accepted count above ground truth — is
the primary safety metric at both stages.**

### Stage 1 — prototype/shadow gates (what M3C measures against)

These govern whether the analyzer is *worth shadowing broadly*, nothing
more. They confer no authority.

| Gate | Threshold |
|---|---|
| Valid-rep precision (benchmark + corpus) | ≥ 0.97 |
| Invalid-rep detection rate | ≥ 0.90 |
| Exact count agreement | ≥ 90% events exact; ≥ 99% within ±1 |
| Event false credit (accepted > truth) | 0 on benchmark/adversarial |
| False failure rate | ≤ 1% |
| Unable-to-verify rate | tracked; target ≤ 25% initially |
| Adversarial suite | 100% pass per release, no regressions |
| Seed corpus | ≥ 40 labeled videos meeting the §6b diversity floors |

### Stage 2 — authoritative promotion (separate, later, harder)

Authority requires substantially stronger real-world evidence than the
prototype stage, with final thresholds **empirically calibrated from
shadow data, never arbitrarily chosen**. The target is near-zero false
verification. Fixed now as *requirements-of-form* rather than numbers:

- A real-world shadow population large enough that the false-credit rate's
  upper confidence bound is credibly near zero — hundreds of events
  minimum, sized from the measured disagreement distribution, not picked
  in advance.
- Diversity floors (§6b) satisfied at the athlete/session level.
- Zero confirmed engine false credits across the entire promotion window;
  any confirmed false credit restarts the window after root-cause fix.
- Calibration verified: confidence dimensions behave as probabilities on
  held-out real data.
- Server-worker execution (parity-pinned), audited policy insert,
  immediate demotion on live degradation — unchanged from the Run Engine.
- Owner approval of the calibrated numbers before the policy flips.

### 6b. Dataset diversity — measured at the athlete/session level (decision 6)

The corpus ledger tracks, per sample: athlete id (pseudonymous), session,
device/camera model, camera angle and distance class, lighting class,
environment (gym/home/outdoor), clothing/background contrast class, body
proportion class, movement style, and per-rep label counts
(valid/invalid/uncertain) with failure modes. Diversity floors are
expressed over athletes and conditions — e.g. no single athlete
contributing more than 15% of labeled reps, minimum athlete counts per
angle/lighting/environment class — so clip volume can never masquerade as
diversity. The benchmark report prints the ledger summary beside the
metrics.

## 8. Adversarial testing

The suite, with expected outcomes fixed per case: partial reps (no top /
no lockout) → reps invalid; chin-tuck reach-overs → invalid or uncertain;
kipping → flagged, uncertain; leaving frame mid-set → event UTV; second
person entering frame → continuity flag + UTV; obstruction/low light →
UTV; **speed-ramped playback** → caught upstream by the integrity engine
(clip duration vs server-clocked window) plus cadence implausibility
(reps/second beyond human) in the analyzer; **video-of-video replays** →
honestly categorized NOT CURRENTLY SOLVED at the analyzer level — held off
by the session challenge (spoken, in-audio), hash-at-capture, and in-app
capture, with screen-detection signals listed as a future engine, not a
claim.

## 9. What M3C does NOT do

No custom model training. No authority for any camera event. No swim work.
No gallery uploads. No biometric identity database (continuity remains
M3E, session-scoped). No silent relaxation of Run Engine gates — the two
engines promote independently, each through its own measured gates.

---

## 10. Implementation plan (phased, review stop after each)

- **M3C-1 — Rep Analyzer core.** `src/domain/calisthenicsEngine/`:
  landmark-stream types, versioned ruleset, bar-line estimation, pull-up
  state machine, per-rep records, event verdict logic with abstention,
  synthetic-stream builders, adversarial + invariant test suites
  (determinism, stream immutability, accepted ≤ detected, no claim input,
  version stamps). Pure TS; zero infrastructure; the milestone's testable
  heart.
- **M3C-2 — Console extraction + shadow.** MediaPipe-JS extraction in the
  review console against evidence videos; landmark artifacts stored;
  shadow rows recorded (`calisthenics_pose`); reviewer UI shows machine
  count + per-rep opinions beside ground truth; per-rep labeling mode
  ships here and every review becomes a dataset sample.
- **M3C-3 — Setup-photo quality gate.** Single-frame server check + GO/FIX
  candidate guidance wired into the verified session flow for pull-ups.
- **M3C-4 — Benchmark + corpus.** Fixture format, metrics suite, report
  generation, seed corpus recorded via Run-Lab-style tooling
  (`Calisthenics Lab`), extractor A/B harness.
- **M3C-5 — Server worker.** Containerized extract+analyze worker on the
  promotion path, parity-pinned; policy stays shadow until §7 gates are
  measured and you flip them.

Push-ups and sit-ups (M3D) reuse every layer — extractor, artifacts,
records, console, gates machinery — swapping only the exercise state
machine and its ruleset entries.
