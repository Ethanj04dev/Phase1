import * as Crypto from 'expo-crypto';

import type { ActiveSession, ExerciseResult, WorkoutResult } from '@/domain/training/types';
import { ok, type Result, type Uuid } from '@/domain/types';

import type { WorkoutRepository } from '@/data/repositories/types';

import { readRecord, StorageKeys, writeRecord } from './storage';

/**
 * Workout persistence.
 *
 * The active session is stored as a whole record on every change. That is
 * wasteful in principle and exactly right in practice: a session is a few
 * kilobytes, and the alternative -- incremental writes -- introduces partial
 * states that a mid-workout crash could leave behind.
 */

function newId(): Uuid {
  return Crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

async function loadResults(): Promise<Result<readonly WorkoutResult[]>> {
  const stored = await readRecord<WorkoutResult[]>(StorageKeys.workoutResults);
  return stored.ok ? ok(stored.value ?? []) : stored;
}

async function loadExerciseResults(): Promise<Result<readonly ExerciseResult[]>> {
  const stored = await readRecord<ExerciseResult[]>(StorageKeys.exerciseResults);
  return stored.ok ? ok(stored.value ?? []) : stored;
}

export const localWorkoutRepository: WorkoutRepository = {
  getActive: async () => readRecord<ActiveSession>(StorageKeys.activeSession),

  saveActive: async (session) => {
    const written = await writeRecord(StorageKeys.activeSession, session);
    return written.ok ? ok(session) : written;
  },

  discardActive: async () => writeRecord(StorageKeys.activeSession, null),

  complete: async (session, durationSeconds) => {
    const existingResults = await loadResults();
    if (!existingResults.ok) {
      return existingResults;
    }
    const existingExercise = await loadExerciseResults();
    if (!existingExercise.ok) {
      return existingExercise;
    }

    const result: WorkoutResult = {
      id: newId(),
      athleteId: session.athleteId,
      // The day is the unit an athlete completes; sessions within it are how
      // the work is grouped for reading, not separate commitments.
      workoutDayId: session.workoutDayId,
      completedAt: now(),
      durationSeconds,
      rpe: session.rpe,
      notes: session.notes.trim().length > 0 ? session.notes.trim() : null,
      distanceMeters: session.entries.reduce(
        (total, entry) => total + (entry.distanceMeters ?? 0),
        0,
      ),
    };

    const exerciseRows: ExerciseResult[] = session.entries.map((entry) => ({
      id: newId(),
      workoutResultId: result.id,
      workoutBlockId: entry.blockId,
      repIndex: entry.repIndex,
      ...(entry.durationSeconds !== undefined
        ? { durationSeconds: entry.durationSeconds }
        : {}),
      ...(entry.distanceMeters !== undefined ? { distanceMeters: entry.distanceMeters } : {}),
      ...(entry.reps !== undefined ? { reps: entry.reps } : {}),
      ...(entry.loadPounds !== undefined ? { loadPounds: entry.loadPounds } : {}),
      ...(entry.rpe !== undefined ? { rpe: entry.rpe } : {}),
    }));

    // Order matters. The per-rep rows are written first, then the parent
    // result, and only then is the draft cleared. A failure at any point
    // leaves the draft intact so the athlete can retry rather than losing
    // the session.
    const wroteExercise = await writeRecord(StorageKeys.exerciseResults, [
      ...existingExercise.value,
      ...exerciseRows,
    ]);
    if (!wroteExercise.ok) {
      return wroteExercise;
    }

    const wroteResult = await writeRecord(StorageKeys.workoutResults, [
      ...existingResults.value,
      result,
    ]);
    if (!wroteResult.ok) {
      return wroteResult;
    }

    const cleared = await writeRecord(StorageKeys.activeSession, null);
    if (!cleared.ok) {
      return cleared;
    }

    return ok(result);
  },

  listResults: async (_athleteId, options) => {
    const stored = await loadResults();
    if (!stored.ok) {
      return stored;
    }
    const newestFirst = [...stored.value].sort((a, b) =>
      b.completedAt.localeCompare(a.completedAt),
    );
    return ok(options?.limit ? newestFirst.slice(0, options.limit) : newestFirst);
  },

  listExerciseResults: async (workoutResultId) => {
    const stored = await loadExerciseResults();
    if (!stored.ok) {
      return stored;
    }
    return ok(
      stored.value
        .filter((row) => row.workoutResultId === workoutResultId)
        .sort((a, b) => a.repIndex - b.repIndex),
    );
  },
};
