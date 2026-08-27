# Supabase setup

The app runs without a backend. Local device storage is the default, and
everything works: onboarding, assessments, readiness, programmes, workout
logging and progress. Configure Supabase when you want accounts and sync
across devices.

## 1. Create the project

Create a project at [supabase.com](https://supabase.com). Note the project URL
and the **anon / publishable** key from Project Settings → API.

## 2. Run the migrations

Open the SQL Editor in the Supabase dashboard and run each file in order:

1. [`migrations/0001_initial_schema.sql`](migrations/0001_initial_schema.sql) —
   five tables, row-level security enabled on every one in the same statement
   block.
2. [`migrations/0002_proficiency_ratings.sql`](migrations/0002_proficiency_ratings.sql)
   — self-assessed skill levels for water confidence. Additive; it touches
   nothing `0001` created.
3. [`migrations/0003_target_readiness.sql`](migrations/0003_target_readiness.sql)
   — one nullable column on `readiness_scores` holding the Target-aware score
   for the same instant. Additive, and it rewrites no existing row.
4. [`migrations/0004_milestone_completions.sql`](migrations/0004_milestone_completions.sql)
   — the athlete's own preparation checklist. Additive, and safe to re-run.

Verify afterwards in Database → Tables that each table shows **RLS enabled**.
If any table is missing it, stop and fix that before pointing the app at the
project.

Until `0002` has been run, a signed-in athlete simply has no skill ratings:
water confidence reads as unmeasured and the rest of the app is unaffected.
The failure is contained on purpose, so a missing migration degrades one domain
rather than breaking a screen.

## 3. Configure the app

```bash
cp .env.example .env
```

Fill in both values, then restart the dev server so Expo picks them up:

```bash
npx expo start --clear
```

`.env` is gitignored. Only ever put the **anon** key in it — the
`service_role` key bypasses row-level security and must never reach a client.

## 4. Verify isolation

Worth doing once, because it is the thing that matters most:

1. Create two accounts.
2. Complete onboarding on the first and log an assessment.
3. Sign in as the second. It must see an empty account and no trace of the
   first athlete's data.

If the second account can see the first one's records, RLS is not doing its
job and the app must not ship.

## What lives where

Programme content — tracks, weeks, days, sessions, blocks — is **not** in the
database. It is authored, ships with the app and is identical for everyone on a
track. Results reference content by stable string id rather than by foreign
key, which keeps content versioned alongside the code that renders it and makes
a content change a release rather than a migration.

The database holds only what is genuinely per-athlete: the profile, assessment
results, readiness snapshots, workout results and per-rep exercise results.

## Data migration on sign-in

An athlete who used the app before creating an account keeps their history. On
first sign-in, if the account has no profile yet, local records are copied up.

Three rules make that safe:

- It only runs when the account is empty. An account that already holds data is
  never merged into, because there is no correct way to reconcile two histories.
- Records are copied, not moved. Nothing local is deleted, so a failure
  part-way leaves the athlete exactly as they were.
- Per-rep exercise rows are not migrated. They reference workout results by an
  id that changes on insert, and the summary on each result already carries
  what the charts need.

## In-progress workouts stay local

An unfinished session is never uploaded. It changes on every logged rep, often
with no signal, and it is meaningless to any other device. Only the finished
result is worth a round trip.
