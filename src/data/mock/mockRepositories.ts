import type { AthleteProfile } from '@/domain/athlete/types';
import { ok, type Result } from '@/domain/types';

import type {
  AthleteRepository,
  ProgramPosition,
  ReadinessRepository,
  Repositories,
  TrainingRepository,
} from '@/data/repositories/types';

import {
  demoProfile,
  demoProgramPosition,
  demoReadiness,
  demoReadinessTrend,
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

const athlete: AthleteRepository = {
  getCurrentProfile: () => delayed<AthleteProfile | null>(profile),
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

const readiness: ReadinessRepository = {
  getLatest: () => delayed(demoReadiness),
  getTrend: () => delayed(demoReadinessTrend),
  listHistory: (_athleteId, options) => {
    const limit = options?.limit ?? 30;
    return delayed([demoReadiness].slice(0, limit));
  },
};

const training: TrainingRepository = {
  getToday: () => delayed(demoToday),
  getPosition: () => delayed<ProgramPosition | null>({ ...demoProgramPosition }),
  getWeeklyCompletion: () => delayed(demoWeeklyCompletion),
  getStreakDays: () => delayed(demoStreakDays),
};

export const mockRepositories: Repositories = { athlete, readiness, training };

/** Restores demo state. Used by tests and by the developer reset action. */
export function resetMockRepositories(): void {
  profile = { ...demoProfile };
}
