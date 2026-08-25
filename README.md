# Phase 1

A performance and training application for athletes preparing for demanding
U.S. military selection and training pipelines.

Phase 1 answers three questions every day:

1. What should I do today?
2. Am I improving?
3. Am I ready?

> Phase 1 is an independent product. It is not affiliated with, endorsed by, or
> associated with the U.S. Department of Defense, any branch of the U.S. Armed
> Forces, or any specific selection or training program. Readiness scores
> measure performance against Phase 1 training benchmarks only and are not a
> prediction of selection outcomes.

## Status

Foundation and application shell. The Today dashboard renders from demo data
through the repository layer. Onboarding, the training system, assessments, the
readiness engine and Supabase persistence are not built yet.

## Requirements

- Node 20 or newer (developed on Node 24)
- No Mac required for development. iOS builds are handled later by EAS Build.

## Getting started

```bash
npm install
```

```bash
npm start
```

Then either:

- **iPhone** — install Expo Go from the App Store and scan the QR code in the
  terminal. Phone and PC must be on the same network.
- **Browser** — press `w`, or run `npm run web`. Useful for fast layout
  iteration on Windows; always confirm the result on a real device.

## Scripts

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `npm start`         | Expo dev server                            |
| `npm run ios`       | Dev server targeting iOS                   |
| `npm run web`       | Dev server in the browser                  |
| `npm run typecheck` | `tsc --noEmit` under strict settings       |
| `npm run lint`      | ESLint (Expo config + Prettier compat)     |
| `npm test`          | Jest unit tests                            |
| `npm run format`    | Prettier write                             |

## Project structure

```
app/                      Expo Router routes only. Screens stay thin.
  _layout.tsx             Providers, splash, root stack
  index.tsx               Boot gate (auth/onboarding routing lives here)
  (tabs)/                 Today, Train, Progress, Profile

src/
  config/                 Branding and legal copy. All brand strings live here.
  theme/                  Design tokens, theme object, ThemeProvider
  components/
    primitives/           Text, Button, Card, Divider, ProgressBar, OptionCard
    layout/               Screen, SectionHeader, Wordmark, GridBackdrop
    data-display/         MetricTile, DeltaBadge, StatusIndicator
    feedback/             AsyncBoundary, PlaceholderScreen
  domain/                 Brand-free business logic and models
    types.ts              Shared primitives, Result type, categories
    goals/                Pipeline catalog and per-goal emphasis weights
    athlete/              Athlete profile, training tracks
    training/             Program hierarchy, workout blocks, results
    readiness/            Readiness snapshot and trend types
  data/
    repositories/         Interfaces the UI depends on
    mock/                 In-memory demo implementation
    supabase/             Reserved for the Supabase implementation
    repositoryContext.tsx Dependency injection point
  features/               Screen-specific composition (hooks + local components)
  lib/                    Pure utilities and hooks
```

## Architecture rules

These are the constraints that keep the codebase workable as it grows.

1. **Screens are thin.** Files in `app/` compose components and call one hook.
   Logic belongs in `src/features/`, `src/domain/` or `src/lib/`.
2. **The domain layer is brand-free.** Nothing under `src/domain/` may reference
   "Phase 1". It deals in `athlete`, `program`, `assessment`, `readiness`. This
   is what makes a white-label build a config change rather than a refactor.
3. **UI never imports data directly.** Components depend on the repository
   interfaces in `src/data/repositories/types.ts`. Swapping mock data for
   Supabase changes one file.
4. **Repositories return `Result`, not exceptions.** Every call site is forced
   to handle the failure path, and raw backend errors never reach a user.
5. **Components consume semantic tokens.** No raw hex, no magic spacing. If a
   value is missing from the theme, add it to the theme.
6. **Status is never colour alone.** `StatusIndicator` requires a label and
   `DeltaBadge` always renders a sign.
7. **Programs declare relationships, not fixed numbers.** A workout specifies a
   `PaceTarget` derived from the athlete's recent performance, so two athletes
   on the same session receive different targets.

## Testing

Deterministic logic is tested; UI is not, yet.

```bash
npm test
```

Priority coverage as the product grows: the readiness scoring system, training
target calculations, and any benchmark tables.

## Backend

Supabase (auth, Postgres, row-level security, storage). Not yet connected. When
it lands:

- Client keys go in `.env` via `EXPO_PUBLIC_*` variables.
- The service-role key is never used in the mobile app.
- Every athlete-owned table gets row-level security scoped to `auth.uid()`.

## Distribution

iOS builds run on EAS Build in the cloud, so no Mac is required. Not configured
yet.
