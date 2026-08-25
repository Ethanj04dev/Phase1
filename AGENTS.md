# Phase 1 — working notes

Read the versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before
writing code. This project is on SDK 57 / React Native 0.86 / React 19.2 /
TypeScript 6.

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
5. Components use semantic theme tokens. No raw hex, no magic numbers.
6. Status is never communicated by colour alone.
7. Workouts declare a `PaceTarget` relationship to recent performance rather
   than hardcoded times.
8. Strict TypeScript. `any` is an ESLint error.

## Scope discipline

The MVP is six systems: onboarding, home dashboard, training, assessments,
readiness, performance history. Do not build AI coaching, social features,
messaging, leaderboards, nutrition, Apple Watch, HealthKit, or subscriptions.
Leave room for them; do not implement them.

## Build order

1. ~~Project architecture~~
2. ~~Design system~~
3. ~~Routing~~
4. ~~Reusable components~~
5. ~~Demo data structure~~
6. ~~Home dashboard shell~~
7. Onboarding flow
8. Readiness engine (pure, unit tested)
9. Training screens and active workout
10. Assessment flow
11. Progress section
12. Profile and settings
13. Supabase auth and persistence

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

Writing files with bash heredocs is unreliable here when the content contains
apostrophes. Use the editor tools for prose-heavy files.
