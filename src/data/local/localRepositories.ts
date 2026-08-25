import * as Crypto from 'expo-crypto';

import type { AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import { calculateTrend } from '@/domain/readiness/score';
import type { ReadinessCalculation, ReadinessSnapshot } from '@/domain/readiness/types';
import { err, ok, type Result, type Uuid } from '@/domain/types';

import { createContentTrainingRepository } from '@/data/content/trainingRepository';
import type {
  AssessmentRepository,
  AthleteRepository,
  NewAssessmentResult,
  NewAthleteProfile,
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
  readiness,
  // Programme content is authored and ships with the app; only the athlete's
  // position in it is personal, and that is derived from their start date.
  training: createContentTrainingRepository(loadProfile, localWorkoutRepository),
  workout: localWorkoutRepository,
};
