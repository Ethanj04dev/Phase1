# Phase 1 — working notes

Read the versioned Expo docs at https://docs.expo.dev/versions/v54.0.0/ before
writing code. This project is on SDK 54 / React Native 0.81.5 / React 19.1 /
TypeScript 5.9.

**Do not upgrade the SDK.** SDK 54 is pinned deliberately: it is the version the
public App Store build of Expo Go supports (`expoGoSdkVersion: 54.0.0`), which
is what allows Windows-to-iPhone testing without a Mac or a dev build. Bumping
the SDK breaks that workflow immediately.

Note that SDK 54 predates unified package versioning, so `expo-*` packages have
independent version numbers (`expo-router@6.x`, `expo-constants@18.x`). That is
correct, not a stale pin. Get versions from Expo tooling, never by guessing:

```bash
npx expo install --fix
```

## What this product is

A training app for athletes preparing for demanding U.S. military selection
pipelines. It must feel like instrumentation for the body: WHOOP or Garmin, not
a tactical costume. No skulls, flames, camouflage, flags, or drill-sergeant
voice. Calm, professional, data-driven.

It is not affiliated with any military organisation and must never imply
endorsement or guarantee selection outcomes.

## Non-negotiable architecture rules

1. Screens in `app/` are thin. Logic lives in `src/features/`, `src/domain/`,
   `src/lib/`.
2. `src/domain/` is brand-free. No "Phase 1" strings. Use `athlete`, `program`,
   `assessment`, `readiness`. Branding lives in `src/config/branding.ts`.
3. UI depends on repository interfaces, never on concrete data sources. Demo
   data is reachable only through `src/data/mock/`.
4. Repositories return `Result<T>`; they do not throw.
5. Components never fetch. Data enters a screen through exactly one hook.
6. Components use semantic theme tokens. No raw hex, no magic numbers.
7. Status is never communicated by colour alone.
8. Workouts declare a `PaceTarget` relationship to recent performance rather
   than hardcoded times.
9. Strict TypeScript. `any` is an ESLint error.
10. Anything numeric, scored, or derived is a pure function in `src/domain/`
    with unit tests. Never inside a component.

## How I work

- **Inspect before changing.** Read the existing code first. Extend it; do not
  rewrite working systems or introduce a second way of doing something.
- **One milestone at a time**, delivered as a vertical slice that runs on the
  device. No half-finished screens left behind.
- **Verify, do not assume.** Every claim in a report is backed by command
  output. If something is untested, say so plainly.
- **New dependencies need a reason.** Check whether an existing package already
  covers it. `react-native-svg` is already present for charts; no chart library.
- **Report honestly.** Failing tests get shown, skipped work gets named.

## Definition of done

A feature is not done until all of these hold:

1. `npm run typecheck && npm run lint && npm test` pass.
2. `npx expo export --platform ios` completes without errors.
3. Every screen handles **loading, empty, error and success**. No screen assumes
   a request succeeds.
4. Errors shown to users are human-readable. Raw backend text never reaches the
   UI.
5. Icon-only controls carry `accessibilityLabel`. Decorative art is hidden from
   assistive technology.
6. Layout survives the largest Dynamic Type setting, or caps scaling
   deliberately with a stated reason.
7. Interactive targets are at least 44pt.
8. Verified on the physical iPhone through Expo Go, not only in a bundler.

## iOS craft rules

- Respect safe areas on every screen. `Screen` already handles this; use it.
- Any list that can grow unbounded uses `FlatList` with `keyExtractor` and
  stable item components. Never `.map()` an unbounded array into a ScrollView.
- Animations run on the UI thread via Reanimated. No animated `setState` loops.
- Keyboard handling is required on every screen with an input. Fields must stay
  visible while typing, and the keyboard must be dismissible.
- Haptics only on meaningful state change (rep logged, session complete). Never
  decorative.
- Never show a bare spinner with no context. Loading states say what is loading.
- Timers and stopwatches derive elapsed time from timestamps, never by
  accumulating interval ticks, which drift and stall when backgrounded.

## Budgets

- Cold start to interactive: under 2 seconds on device.
- Scrolling stays at 60fps. No dropped frames on the dashboard or history lists.
- No bundled image over 200KB without a stated reason.
- Text contrast meets WCAG AA. Verify new colours before adding them.

## Security

- No secrets in client code, ever. Only `EXPO_PUBLIC_*` publishable keys.
- The Supabase service-role key never appears in the app.
- Every athlete-owned table gets row-level security scoped to `auth.uid()`
  before any UI reads from it.

## Scope discipline

The MVP is six systems: onboarding, home dashboard, training, assessments,
readiness, performance history. Do not build AI coaching, social features,
messaging, leaderboards, nutrition, Apple Watch, HealthKit, or subscriptions.
Leave room for them; do not implement them.

## Build order

See `docs/ROADMAP.md` for the milestone plan, deliverables and current
position. That file is the single source of truth for what gets built next.

## Gates before calling anything done

```bash
npm run typecheck && npm run lint && npm test
```

The iOS bundle must also export cleanly:

```bash
npx expo export --platform ios --output-dir .expo-verify
```

## Windows notes

Development is on Windows; no Mac is available. Everything must work through
Expo Go on a physical iPhone plus EAS Build for distribution. Avoid anything
requiring local Xcode.

**Never put this project inside OneDrive.** It lives at `C:\Dev\Phase1` for a
reason. When it was under `OneDrive\Desktop`, OneDrive sync re-uploaded a stale
`node_modules`, mixed two SDK versions in one tree, and produced 178 conflict
files named `*-EthanJ*`. The symptom was a bogus
`Cannot find module './plugin/build/withRouter'` from expo-router. If that error
reappears, check the installed version against `package.json` before debugging
anything else.

Writing files with bash heredocs is unreliable here when the content contains
apostrophes. Use the editor tools for prose-heavy files.
