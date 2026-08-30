import * as Crypto from 'expo-crypto';

import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { CandidateProfile } from '@/domain/candidate/types';
import { calculateTrend } from '@/domain/readiness/score';
import type { ReadinessCalculation, ReadinessSnapshot } from '@/domain/readiness/types';
import type { MilestoneCompletion } from '@/domain/pipeline/milestones';
import type {
  NewProficiencyRating,
  ProficiencyRating,
} from '@/domain/pipeline/proficiency';
import { err, ok, type Result, type Uuid } from '@/domain/types';

import { createContentTrainingRepository } from '@/data/content/trainingRepository';
import type {
  AssessmentRepository,
  AthleteRepository,
  CandidateRepository,
  NewAssessmentResult,
  NewAthleteProfile,
  NewCandidateProfile,
  MilestoneRepository,
  ProficiencyRepository,
  ReadinessRepository,
  Repositories,
} from '@/data/repositories/types';

import { readRecord, StorageKeys, writeRecord } from './storage';
import { localWorkoutRepository } from './workoutRepository';

/**
 * Repositories backed by durable local storage.
 *
 * This is what the app runs on from M2 until Supabase lands. It is not a sync
 * engine and not offline-first: it is the athlete's own data, on their own
 * device, surviving a restart. In M8 the Supabase implementations replace
 * these behind the same interfaces.
 */

const NOT_FOUND = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

function newId(): Uuid {
  return Crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// --- Athlete -----------------------------------------------------------------

async function loadProfile(): Promise<Result<AthleteProfile | null>> {
  return readRecord<AthleteProfile>(StorageKeys.athleteProfile);
}

const athlete: AthleteRepository = {
  getCurrentProfile: loadProfile,

  createProfile: async (input: NewAthleteProfile) => {
    const timestamp = now();
    const profile: AthleteProfile = {
      ...input,
      id: newId(),
      // Placeholder until Supabase Auth owns identity in M8. Local-only data
      // still needs a stable owner id so the migration has something to map.
      userId: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const written = await writeRecord(StorageKeys.athleteProfile, profile);
    return written.ok ? ok(profile) : written;
  },

  updateProfile: async (id, patch) => {
    const existing = await loadProfile();
    if (!existing.ok) {
      return existing;
    }
    if (!existing.value) {
      return err(NOT_FOUND);
    }

    const updated: AthleteProfile = {
      ...existing.value,
      ...patch,
      id,
      updatedAt: now(),
    };

    const written = await writeRecord(StorageKeys.athleteProfile, updated);
    return written.ok ? ok(updated) : written;
  },
};

// --- Candidate ---------------------------------------------------------------

async function loadCandidate(): Promise<Result<CandidateProfile | null>> {
  return readRecord<CandidateProfile>(StorageKeys.candidateProfile);
}

const CANDIDATE_NOT_FOUND = {
  code: 'not_found' as const,
  message: 'We could not find your candidate profile.',
};

const candidate: CandidateRepository = {
  getMine: loadCandidate,

  create: async (input: NewCandidateProfile) => {
    const timestamp = now();
    const existingProfile = await loadProfile();
    const profile: CandidateProfile = {
      ...input,
      id: newId(),
      // Tied to the athlete profile's owner where one exists, so the
      // migration to an account moves both records under one identity.
      userId: existingProfile.ok ? (existingProfile.value?.userId ?? newId()) : newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const written = await writeRecord(StorageKeys.candidateProfile, profile);
    return written.ok ? ok(profile) : written;
  },

  update: async (id, patch) => {
    const existing = await loadCandidate();
    if (!existing.ok) {
      return existing;
    }
    if (!existing.value) {
      return err(CANDIDATE_NOT_FOUND);
    }

    const updated: CandidateProfile = {
      ...existing.value,
      ...patch,
      id,
      updatedAt: now(),
    };

    const written = await writeRecord(StorageKeys.candidateProfile, updated);
    return written.ok ? ok(updated) : written;
  },

  // Local storage has one candidate: their own. A handle only becomes truly
  // claimed when an account exists, and the UI says so.
  isHandleAvailable: async () => ok(true),
};

// --- Assessments -------------------------------------------------------------

async function loadResults(): Promise<Result<readonly AssessmentResult[]>> {
  const stored = await readRecord<AssessmentResult[]>(StorageKeys.assessmentResults);
  return stored.ok ? ok(stored.value ?? []) : stored;
}

const assessment: AssessmentRepository = {
  listResults: async (_athleteId, options) => {
    const stored = await loadResults();
    if (!stored.ok) {
      return stored;
    }
    // Newest first, matching the eventual Supabase query ordering.
    const ordered = [...stored.value].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return ok(options?.limit ? ordered.slice(0, options.limit) : ordered);
  },

  recordResults: async (athleteId, entries: readonly NewAssessmentResult[]) => {
    const stored = await loadResults();
    if (!stored.ok) {
      return stored;
    }

    // One timestamp for the whole batch: these performances happened at the
    // same sitting, and sharing an instant keeps history grouped correctly.
    const recordedAt = now();
    const created: AssessmentResult[] = entries.map((entry) => ({
      id: newId(),
      athleteId,
      eventId: entry.eventId,
      value: entry.value,
      recordedAt,
      notes: entry.notes ?? null,
    }));

    const written = await writeRecord(StorageKeys.assessmentResults, [
      ...stored.value,
      ...created,
    ]);
    return written.ok ? ok(created) : written;
  },
};

// --- Proficiency -------------------------------------------------------------

async function loadRatings(): Promise<Result<readonly ProficiencyRating[]>> {
  const stored = await readRecord<ProficiencyRating[]>(StorageKeys.proficiencyRatings);
  return stored.ok ? ok(stored.value ?? []) : stored;
}

const proficiency: ProficiencyRepository = {
  listRatings: async (_athleteId, options) => {
    const stored = await loadRatings();
    if (!stored.ok) {
      return stored;
    }
    const ordered = [...stored.value].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return ok(options?.limit ? ordered.slice(0, options.limit) : ordered);
  },

  recordRatings: async (athleteId, entries: readonly NewProficiencyRating[]) => {
    const stored = await loadRatings();
    if (!stored.ok) {
      return stored;
    }

    // One timestamp for the batch, matching how assessments are stored: these
    // ratings are one honest sitting, not five separate judgements.
    const recordedAt = now();
    const created: ProficiencyRating[] = entries.map((entry) => ({
      id: newId(),
      athleteId,
      domainId: entry.domainId,
      skillId: entry.skillId,
      level: entry.level,
      recordedAt,
      notes: entry.notes ?? null,
    }));

    const written = await writeRecord(StorageKeys.proficiencyRatings, [
      ...stored.value,
      ...created,
    ]);
    return written.ok ? ok(created) : written;
  },
};

// --- Milestones --------------------------------------------------------------

async function loadMilestones(): Promise<Result<readonly MilestoneCompletion[]>> {
  const stored = await readRecord<MilestoneCompletion[]>(StorageKeys.milestoneCompletions);
  return stored.ok ? ok(stored.value ?? []) : stored;
}

const milestone: MilestoneRepository = {
  listCompletions: async () => loadMilestones(),

  setCompleted: async (athleteId, milestoneId, completed) => {
    const stored = await loadMilestones();
    if (!stored.ok) {
      return stored;
    }

    // Filtering first makes both directions idempotent: completing twice
    // cannot leave two rows, and uncompleting something absent is a no-op.
    const without = stored.value.filter((entry) => entry.milestoneId !== milestoneId);
    const next = completed
      ? [...without, { id: newId(), athleteId, milestoneId, completedAt: now() }]
      : without;

    const written = await writeRecord(StorageKeys.milestoneCompletions, next);
    return written.ok ? ok(undefined) : written;
  },
};

// --- Readiness ---------------------------------------------------------------

async function loadSnapshots(): Promise<Result<readonly ReadinessSnapshot[]>> {
  const stored = await readRecord<ReadinessSnapshot[]>(StorageKeys.readinessSnapshots);
  return stored.ok ? ok(stored.value ?? []) : stored;
}

/** Oldest first, which is what the trend calculation expects. */
function chronological(snapshots: readonly ReadinessSnapshot[]): readonly ReadinessSnapshot[] {
  return [...snapshots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

const readiness: ReadinessRepository = {
  getLatest: async () => {
    const stored = await loadSnapshots();
    if (!stored.ok) {
      return stored;
    }
    const ordered = chronological(stored.value);
    return ok(ordered[ordered.length - 1] ?? null);
  },

  getTrend: async (_athleteId, windowDays) => {
    const stored = await loadSnapshots();
    if (!stored.ok) {
      return stored;
    }
    return ok(calculateTrend(chronological(stored.value), windowDays, now()));
  },

  listHistory: async (_athleteId, options) => {
    const stored = await loadSnapshots();
    if (!stored.ok) {
      return stored;
    }
    const newestFirst = [...chronological(stored.value)].reverse();
    return ok(options?.limit ? newestFirst.slice(0, options.limit) : newestFirst);
  },

  record: async (athleteId, calculation: ReadinessCalculation) => {
    const stored = await loadSnapshots();
    if (!stored.ok) {
      return stored;
    }

    const snapshot: ReadinessSnapshot = {
      ...calculation,
      id: newId(),
      athleteId,
      recordedAt: now(),
    };

    const written = await writeRecord(StorageKeys.readinessSnapshots, [
      ...stored.value,
      snapshot,
    ]);
    return written.ok ? ok(snapshot) : written;
  },
};

// --- Composition -------------------------------------------------------------

export const localRepositories: Repositories = {
  athlete,
  assessment,
  candidate,
  milestone,
  proficiency,
  readiness,
  // Programme content is authored and ships with the app; only the athlete's
  // position in it is personal, and that is derived from their start date.
  training: createContentTrainingRepository(loadProfile, localWorkoutRepository),
  workout: localWorkoutRepository,
};
