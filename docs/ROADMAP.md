# Phase 1 — Build Plan

Single source of truth for what gets built next. Update the status line when a
milestone lands.

**Current position:** M2 complete. M3 next.

---

## Principles behind the ordering

Three rules decide what comes next, in this priority:

1. **Dependencies first.** Nothing gets built before the thing it needs to
   exist.
2. **De-risk the uncertain early.** The readiness engine is the product's
   differentiator and the piece most likely to need rework. It is pure logic, so
   getting it wrong is cheap to discover and cheap to fix — but only if it is
   built before four screens depend on it.
3. **Every milestone runs on the device.** No milestone ends with a feature that
   cannot be opened in Expo Go and used.

### One deliberate deviation from the original order

The original brief listed onboarding (7) before the readiness engine (8). That
order does not survive contact: the final onboarding screen *is* a readiness
result — `READINESS 58 / STRONGEST Calisthenics / PRIORITY Swimming`. Building
onboarding first means either stubbing that screen and returning to it, or
writing scoring logic inline in a component, which rule 10 forbids.

So the engine moves first. It is roughly a day of pure, testable logic and it
unblocks onboarding, the dashboard, and assessments simultaneously.

### Persistence lands before Supabase, not with it

Today every repository is in-memory. If onboarding shipped against that, the
athlete's profile would evaporate on every reload and the app would be
untestable on a real phone for months.

So M2 adds an **AsyncStorage-backed repository implementation** behind the
existing interfaces. Not offline-first architecture — just durable local
storage. This costs little, makes the app genuinely usable immediately, and
turns M8 into a repository swap rather than the first time persistence is
exercised.

---

## M0 — Foundation *(complete)*

Expo Router shell, design system, primitives, domain models, repository seam,
mock data, Today dashboard, branding and icon set.

---

## M1 — Readiness engine *(complete)*

**Goal:** a deterministic, transparent, unit-tested scoring system.

**Deliverables**
- `src/domain/assessment/types.ts` — assessment definitions and result records
  for the six standard events (pull-ups, push-ups, sit-ups, 1 mile, 1.5 mile,
  500m swim), plus an optional ruck event.
- `src/domain/readiness/benchmarks.ts` — benchmark tables mapping raw
  performance to a 0–100 category score. Plain data, editable without touching
  code, versioned so historical snapshots stay interpretable.
- `src/domain/readiness/score.ts` — `scoreEvent`, `scoreCategory`,
  `scoreOverall`, coverage, strongest and priority category selection.
- Unit tests covering: monotonicity (a faster mile never lowers the score),
  clamping at both ends, missing-data handling, correct application of goal
  emphasis weights, and coverage arithmetic.

**Design constraints**
- Deterministic and explainable. Given the same inputs it always returns the
  same score, and a human can trace why.
- No claim of prediction. The score measures performance against Phase 1
  benchmarks only.
- Interpolation between benchmark anchors, so scores move smoothly rather than
  jumping at thresholds.
- Coverage is reported, never hidden. A score built on two of six events must
  say so.

**Done when** the engine is fully unit tested and the Today dashboard renders a
computed score instead of a hardcoded snapshot.

---

## M2 — Onboarding and local persistence *(complete)*

**Goal:** a new athlete can install, set up, and have that survive a restart.

**Deliverables**
- Route group `app/(onboarding)/`: welcome, goal, experience, baseline, result.
- Draft state provider with per-step validation and a progress indicator.
- `src/data/local/` — AsyncStorage repository implementation behind the
  existing interfaces, with a schema version field for future migrations.
- Boot gate in `app/index.tsx` decides onboarding vs tabs from persisted state.
- Baseline entry supports **TEST LATER** on every field. Partial data produces a
  partial score with honest coverage, never a blocked flow.
- Result screen showing initial readiness, strongest category, priority
  category, and `BEGIN PHASE 1`.

**Done when** onboarding can be completed on the phone, the app is killed and
reopened, and it lands on the dashboard with the athlete's real data.

---

## M3 — Assessment system

**Goal:** athletes can test, log, and see improvement.

**Deliverables**
- Assessment entry with input types per event (reps, time, distance).
- Full history, newest first, paged. Results are append-only — never overwrite a
  previous performance.
- Personal records derived from result history.
- Recompute and store a readiness snapshot on each assessment.
- Trend readout per event: `10:42 → 9:28`, improvement `1:14`.

**Why here:** assessments are the data source both for readiness and for
personalised training targets. Training cannot compute a target pace before
there is a recent performance to derive it from.

**Done when** logging an assessment visibly moves the readiness score and the
history shows the trend.

---

## M4 — Training program and navigation

**Goal:** the athlete can see the plan and what any given session asks of them.

**Deliverables**
- Original programme content for the three tracks (Foundation, Selection Prep,
  Advanced) — realistic, written for this product, not adapted from any
  third-party paid programme.
- `src/domain/training/targets.ts` — pure resolution of `PaceTarget` plus recent
  performance into concrete numbers, with unit tests. Two athletes on the same
  session get different targets.
- Program overview, week calendar, workout overview screens.
- Content lives as structured data, loaded through a repository.

**Done when** two athletes with different assessment results open the same
session and see different target windows.

---

## M5 — Active workout

**Goal:** the interactive session. The hardest screen in the product.

**Deliverables**
- Rep-by-rep logging against targets, with a running comparison to the window.
- Timestamp-derived timers that survive backgrounding.
- Entry for time, reps, distance, load, RPE and notes.
- Session complete summary: duration, volume, performance vs target, RPE.
- Persist `workout_results` and `exercise_results`.
- Haptic confirmation on rep completion.

**Risks:** this screen is used mid-effort, sweating, possibly outdoors. Targets
must be large, the flow must tolerate interruption, and nothing may be lost if
the app is backgrounded mid-session.

**Done when** a full session can be completed on the phone, backgrounded
halfway, and resumed without data loss.

---

## M6 — Progress

**Goal:** the "am I improving" answer, with evidence.

**Deliverables**
- Personal records board.
- Trend charts hand-built on `react-native-svg`: event times, readiness history,
  weekly volume, consistency. No chart library.
- Strongest and weakest category, recent improvement and decline.
- Paged history queries. Never load all history at once.

---

## M7 — Profile and settings

**Goal:** the athlete can change what they told us.

**Deliverables**
- Edit goal, track, training days, experience levels. Changing a goal
  recomputes readiness because emphasis weights change.
- Units preference.
- Disclaimers and about (already present, formalised).
- Reset local data, for development and for testing onboarding repeatedly.

---

## M8 — Supabase

**Goal:** real accounts, real persistence, correct isolation.

**Deliverables**
- SQL migrations for the full schema with foreign keys and timestamps.
- Row-level security on every athlete-owned table, scoped to `auth.uid()`,
  written and verified **before** any UI reads from it.
- Email/password auth, session persistence, auth state provider.
- `src/data/supabase/` implementations of the existing repository interfaces.
- Migration path from local storage to the account on first sign-in.
- Introduce **TanStack Query** here, and only here. Justification: this is the
  first point at which the same server state is read by multiple screens and
  needs caching, invalidation and refetch-on-focus. Before this, the state is
  local and a query library would be dead weight. The `AsyncState` shape in
  `useAsyncResource` already maps onto it, so components should not change.

---

## M9 — Hardening and release

**Deliverables**
- Accessibility pass: VoiceOver walkthrough of every flow, Dynamic Type at
  maximum, contrast audit of any colours added along the way.
- Performance pass: cold start, list frame rates, bundle size.
- Error-state audit: every screen against the four-state rule.
- EAS Build configuration and a TestFlight build. This is the first point a
  development build is needed, and the first time the helmet icon appears on the
  home screen.

---

## Cross-cutting decisions

| Decision | Choice | Reason |
|---|---|---|
| State management | None until M8, then TanStack Query | Local state needs no library; server state does |
| Charts | Hand-built on `react-native-svg` | Already a dependency; full design control |
| Offline-first | Not built | Interfaces stay async and local-first so it remains possible |
| Dev build | Not until M9 | Expo Go keeps the Windows-to-iPhone loop working |
| Testing | Pure logic only | Scoring, targets, formatters. No screen snapshot tests |
| Content | Written for this product | Never adapted from third-party paid programmes |

## Standing risks

- **Benchmark credibility.** Scores must be defensible without citing any
  organisation's standards. Benchmarks are versioned so they can be retuned
  without invalidating history.
- **Content volume.** Three tracks of realistic programming is the largest
  non-code effort in the MVP. If it becomes the bottleneck, ship Selection Prep
  complete and the other two shorter, rather than three shallow tracks.
- **Active workout complexity.** M5 is the highest-risk screen. Budget for it.
- **No backup.** The repository has never been pushed. This should be resolved
  before significant further work.
