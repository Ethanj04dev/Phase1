import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { CandidateProfile } from '@/domain/candidate/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { calculateReadiness, calculateTrend } from '@/domain/readiness/score';
import type { ReadinessSnapshot } from '@/domain/readiness/types';
import type { MilestoneCompletion } from '@/domain/pipeline/milestones';
import type { ProficiencyRating } from '@/domain/pipeline/proficiency';
import { ok, type Result } from '@/domain/types';

import type {
  AssessmentRepository,
  AthleteRepository,
  CandidateRepository,
  MilestoneRepository,
  ProficiencyRepository,
  ReadinessRepository,
  Repositories,
  TrainingRepository,
  WorkoutRepository,
} from '@/data/repositories/types';

import { createContentTrainingRepository } from '@/data/content/trainingRepository';
import { createInMemoryWorkoutRepository } from './inMemoryWorkoutRepository';
import {
  demoAssessmentDates,
  demoAssessmentResults,
  demoNow,
  demoProfile,
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
 * The demo athlete has rated nothing.
 *
 * Deliberate: it is the state that exposes the unmeasured-domain handling, and
 * seeding plausible water ratings would hide the exact case the Target work
 * exists to get right.
 */
let extraRatings: readonly ProficiencyRating[] = [];

const proficiency: ProficiencyRepository = {
  listRatings: () => delayed([...extraRatings]),
  recordRatings: (athleteId, entries) => {
    const recordedAt = new Date().toISOString();
    const created: ProficiencyRating[] = entries.map((entry, index) => ({
      id: `mock-rating-${extraRatings.length + index}`,
      athleteId,
      domainId: entry.domainId,
      skillId: entry.skillId,
      level: entry.level,
      recordedAt,
      notes: entry.notes ?? null,
    }));
    extraRatings = [...extraRatings, ...created];
    return delayed(created);
  },
};

let extraMilestones: readonly MilestoneCompletion[] = [];

const milestone: MilestoneRepository = {
  listCompletions: () => delayed([...extraMilestones]),
  setCompleted: (athleteId, milestoneId, completed) => {
    const without = extraMilestones.filter((entry) => entry.milestoneId !== milestoneId);
    extraMilestones = completed
      ? [
          ...without,
          {
            id: `mock-milestone-${without.length}`,
            athleteId,
            milestoneId,
            completedAt: new Date().toISOString(),
          },
        ]
      : without;
    return delayed(undefined);
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

// --- Candidate ---------------------------------------------------------------

const demoCandidate: CandidateProfile = {
  id: 'mock-candidate',
  userId: demoProfile.userId,
  handle: 'demo_candidate',
  displayHandle: 'Demo_Candidate',
  displayName: null,
  pipelineId: demoProfile.goalId,
  stateCode: 'FL',
  visibility: 'private',
  bio: null,
  avatarUrl: null,
  createdAt: demoProfile.createdAt,
  updatedAt: demoProfile.createdAt,
};

let candidateProfile: CandidateProfile | null = { ...demoCandidate };

const candidate: CandidateRepository = {
  getMine: () => delayed<CandidateProfile | null>(candidateProfile),
  create: (input) => {
    candidateProfile = {
      ...input,
      id: demoCandidate.id,
      userId: demoCandidate.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return delayed(candidateProfile);
  },
  update: (id, patch) => {
    candidateProfile = {
      ...(candidateProfile ?? demoCandidate),
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    return delayed(candidateProfile);
  },
  isHandleAvailable: (handle) =>
    // A deterministic taken handle so the availability UI can be exercised.
    delayed(handle !== 'taken'),
};

// Programme content is authored and shared by every implementation; only the
// athlete's position in it differs. There is no mock version to maintain.
const workout: WorkoutRepository = createInMemoryWorkoutRepository();

const training: TrainingRepository = createContentTrainingRepository(
  () => delayed<AthleteProfile | null>(profile),
  workout,
);

export const mockRepositories: Repositories = {
  athlete,
  assessment,
  candidate,
  milestone,
  proficiency,
  readiness,
  training,
  workout,
};

/** Restores demo state. Used by tests and by the developer reset action. */
export function resetMockRepositories(): void {
  profile = { ...demoProfile };
  candidateProfile = { ...demoCandidate };
  extraResults = [];
  extraRatings = [];
  extraMilestones = [];
}
