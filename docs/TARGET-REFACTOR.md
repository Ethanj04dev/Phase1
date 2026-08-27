# Refactor plan — Phase 1 as a preparation platform

Phase 1 stops being a workout tracker with military branding and becomes a
structured preparation system. This plan is the route from what exists to that,
without a rewrite.

**Status:** planned, not started.

---

## What exists today

25 route files, 19 domain modules, 20 feature modules, 15 data modules.
285 tests. Everything below is verified working.

### Keep unchanged — this is why the refactor is affordable

| Area | Why it survives |
|---|---|
| Repository seam (`Result<T>`, interfaces, local/Supabase/mock) | The UI never learned where data comes from. Screens can be rebuilt without touching persistence. |
| Assessment records — PRs, per-event progress, improvement | Direction-agnostic already; works for any event set. |
| Session logic — timestamp timer, rep verdicts, summaries | No knowledge of categories or careers. |
| Consistency, volume, schedule | Same. |
| `PaceTarget` resolution + Riegel conversion | Already the "relationship not a number" model the new spec wants. |
| Programme content builder | Extends to new session types; no rewrite. |
| Primitives, charts, `AsyncBoundary`, contrast gate | Design tokens change, components do not. |

### Must change

| Area | Problem | Files touched |
|---|---|---|
| `PERFORMANCE_CATEGORIES` | Global constant of 4. Must become Target-defined. | 15 |
| `Goal` → `TargetDefinition` | A name, a branch and 4 weights. Needs standards, pipeline, demands, intel, milestones, sources. | 19 |
| Readiness scoring | Hardcoded to the global 4. | score, movement, types |
| Benchmarks | One global table. Needs per-Target Phase 1 targets, held separately from official standards. | benchmarks |
| Navigation | 4 tabs. Needs 5. | tabs layout |
| Today / Train / Progress | Rigid, uniform-weight, box-heavy. | 3 screens |
| Typography and borders | Too much caps/mono/tracking; too many outlines. | theme + most screens |

---

## The central model change

Today a category is a global fact. It must become a property of the Target.

```
TargetDefinition
  id, name, shortName, branch, description
  preparationDomains  -> which domains are scored, and their weight
  standards           -> OFFICIAL, with source provenance
  phase1Targets       -> Phase 1's own benchmarks, clearly distinct
  assessments         -> official vs Phase 1
  physicalDemands     -> with an explanation of why each matters
  pipelineStages
  milestones
  careerIntel
  sources
```

Two rules this encodes, both non-negotiable:

1. **Official and Phase 1 data never share a field.** A Phase 1 benchmark must
   be structurally incapable of rendering as an official requirement. Separate
   types, separate fields, separate labels.
2. **Unverified means unverified.** Absent official data renders as
   "Verification required", never as a plausible-looking number.

`PerformanceCategory` becomes a registry of every domain the product knows
(running, swimming, water confidence, calisthenics, strength, rucking,
durability, training consistency). A Target selects a subset with weights.
Readiness scores only the domains its Target defines.

---

## Order of work

Each step ends with the app runnable and the gates green.

1. **Domain model** — `TargetDefinition`, provenance types, domain registry.
   No UI change. Tests prove weights normalise and official/Phase 1 stay apart.
2. **Target-aware readiness** — scoring reads domains from the Target.
   Existing readiness must produce identical output for the current 4 domains.
3. **PJ Target definition** — the first and only fully populated Target, with
   placeholders where official data is unverified.
4. **Five tabs** — add Target. Existing screens keep working.
5. **Target shell** — overview plus the seven sections as drill-downs.
6. **Road to Ready** — priority engine over gaps. Pure and tested.
7. **Water Confidence** — domain, session type, level-based assessments,
   safety metadata surfaced at the session, not buried.
8. **Today redesign** — hierarchy, not a dashboard.
9. **Train redesign** — weekly calendar with real state differentiation.
10. **Progress** — Road to Ready progress, intentional empty states.
11. **Pipeline / Milestones / Career Intel.**
12. **Profile reorganisation.**
13. **Design and typography pass** across everything.

---

## Decisions taken, with reasons

### Design: the stencil direction gets softened

The previous pass took the logo literally — heavy uppercase, wide tracking,
mono everywhere, hard 3px edges, visible borders. This spec explicitly asks for
the opposite: fewer borders, less caps and mono, "polished consumer iOS
software", "not a fake military HUD".

Resolution: keep the black ground, keep blue as the primary interaction colour,
keep white for emphasis. Soften everything else — sentence-case titles, mono
reserved for genuine metadata, borders replaced by surface separation and
spacing. The mark stays gritty; the interface stops imitating it.

### Strength returns as a domain, but not as a max lift

Strength was removed because scoring it honestly needs a near-maximal lift,
which is irresponsible for a population that includes complete beginners. The
spec lists it as a preparation domain, so it returns — but scored from safe
proxies (weighted or high-rep calisthenics, loaded carries), never a 1RM. Where
no safe assessment exists for a Target, the domain carries no score and says so
rather than inventing one.

### Water Confidence needs a new measurement kind

Every assessment today is reps or seconds. "Treading: Developing" is neither.
Water Confidence needs ordinal levels (not started / developing / competent /
strong), which is a real addition to the assessment model rather than a label
change.

### Breath-hold is never scored

No breath-hold PR, no underwater distance, no records, no streaks, nothing
competitive. Underwater work carries `requiresSupervision` and renders its
safety notice on the session itself. This is a safety constraint, not a
preference, and it outranks completeness.

---

## Carried over, still open

The Supabase two-account isolation test is unfinished. This refactor does not
block it, and it stays outstanding: no athlete data should reach real users
until it passes.

`athlete_profiles.goal_id` becomes `target_id`, which is a migration rather
than an edit to `0001`, since `0001` has already been run. It is now numbered
`0003`, because `0002` was taken by `proficiency_ratings`.

`0002_proficiency_ratings.sql` needs running against the live project before a
signed-in athlete can save skill ratings. Until then water confidence reads as
unmeasured for them, which the readiness model already handles; nothing breaks.

Today no longer shows a readiness trend. The stored snapshots come from the
legacy four-category engine, and rendering that delta under a Target-aware
score would put two different scales in one sentence. Improvement over time
returns on Progress once Target-aware snapshots are being recorded, which is
step 10.

Safety notices currently surface on the skill-rating screen. Surfacing them on
the water *sessions* themselves is step 9 work, and it is not done. The rating
screen is where an athlete decides what to practise, so it is the right first
place, but it is not the last one.
