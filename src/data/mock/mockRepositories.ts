import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { calculateReadiness, calculateTrend } from '@/domain/readiness/score';
import type { ReadinessSnapshot } from '@/domain/readiness/types';
import { ok, type Result } from '@/domain/types';

import type {
  AssessmentRepository,
  AthleteRepository,
  ProgramPosition,
  ReadinessRepository,
  Repositories,
  TrainingRepository,
} from '@/data/repositories/types';

import {
  demoAssessmentDates,
  demoAssessmentResults,
  demoNow,
  demoProfile,
  demoProgramPosition,
  demoStreakDays,
  demoToday,
  demoWeeklyCompletion,
} from './demoAthlete';

/**
 * In-memory repositories backed by demo content.
 *
 * A small artificial delay is deliberate: it keeps loading states on screen
 * during development so they get designed rather than discovered in
 * production.
 */
const SIMULATED_LATENCY_MS = 220;

function delayed<T>(value: T): Promise<Result<T>> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(ok(value)), SIMULATED_LATENCY_MS);
  });
}

/** Mutable copy so profile updates persist for the life of the session. */
let profile: AthleteProfile = { ...demoProfile };

let extraResults: AssessmentResult[] = [];

const athlete: AthleteRepository = {
  getCurrentProfile: () => delayed<AthleteProfile | null>(profile),
  createProfile: (input) => {
    profile = {
      ...input,
      id: profile.id,
      userId: profile.userId,
      createdAt: profile.createdAt,
      updatedAt: new Date().toISOString(),
    };
    return delayed(profile);
  },
  updateProfile: (id, patch) => {
    profile = {
      ...profile,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    return delayed(profile);
  },
};

const assessment: AssessmentRepository = {
  listResults: () => delayed([...demoAssessmentResults, ...extraResults]),
  recordResults: (athleteId, entries) => {
    const recordedAt = new Date().toISOString();
    const created: AssessmentResult[] = entries.map((entry, index) => ({
      id: `mock-result-${extraResults.length + index}`,
      athleteId,
      eventId: entry.eventId,
      value: entry.value,
      recordedAt,
      notes: entry.notes ?? null,
    }));
    extraResults = [...extraResults, ...created];
    return delayed(created);
  },
};

/**
 * Builds the readiness history by scoring the athlete as they stood after each
 * round of testing. Nothing is hardcoded: change a demo performance and the
 * dashboard, the trend and the priority category all move accordingly.
 */
function buildHistory(): ReadinessSnapshot[] {
  const goal = getGoalOrDefault(profile.goalId);
  const snapshots: ReadinessSnapshot[] = [];

  for (const date of demoAssessmentDates) {
    const resultsToDate = demoAssessmentResults.filter(
      (result: AssessmentResult) => result.recordedAt <= date,
    );
    const calculation = calculateReadiness(goal, resultsToDate);
    if (!calculation) {
      continue;
    }
    snapshots.push({
      ...calculation,
      id: `demo-readiness-${date}`,
      athleteId: profile.id,
      recordedAt: date,
    });
  }

  return snapshots;
}

const READINESS_TREND_WINDOW_DAYS = 30;

const readiness: ReadinessRepository = {
  getLatest: () => {
    const history = buildHistory();
    return delayed<ReadinessSnapshot | null>(history[history.length - 1] ?? null);
  },
  getTrend: (_athleteId, windowDays = READINESS_TREND_WINDOW_DAYS) =>
    delayed(calculateTrend(buildHistory(), windowDays, demoNow)),
  listHistory: (_athleteId, options) => {
    // Newest first, matching the eventual Supabase query ordering.
    const history = buildHistory().reverse();
    return delayed(history.slice(0, options?.limit ?? 30));
  },
  record: (athleteId, calculation) =>
    // The mock derives history from demo results rather than storing it, so
    // this returns a stamped snapshot without persisting anything.
    delayed({
      ...calculation,
      id: 'mock-readiness-recorded',
      athleteId,
      recordedAt: new Date().toISOString(),
    }),
};

const training: TrainingRepository = {
  getToday: () => delayed(demoToday),
  getPosition: () => delayed<ProgramPosition | null>({ ...demoProgramPosition }),
  getWeeklyCompletion: () => delayed(demoWeeklyCompletion),
  getStreakDays: () => delayed(demoStreakDays),
};

export const mockRepositories: Repositories = {
  athlete,
  assessment,
  readiness,
  training,
};

/** Restores demo state. Used by tests and by the developer reset action. */
export function resetMockRepositories(): void {
  profile = { ...demoProfile };
  extraResults = [];
}
