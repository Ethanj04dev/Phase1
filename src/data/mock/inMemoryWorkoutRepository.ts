import type {
  ActiveSession,
  ExerciseResult,
  WorkoutResult,
} from '@/domain/training/types';
import { ok } from '@/domain/types';

import type { WorkoutRepository } from '@/data/repositories/types';

/**
 * Workout repository for tests and previews. Same contract as the local one,
 * without touching storage, so a test can drive a full session and assert on
 * what came out.
 */
export function createInMemoryWorkoutRepository(): WorkoutRepository {
  let active: ActiveSession | null = null;
  let results: WorkoutResult[] = [];
  let exerciseResults: ExerciseResult[] = [];
  let counter = 0;

  const nextId = (prefix: string): string => {
    counter += 1;
    return `${prefix}-${counter}`;
  };

  return {
    getActive: () => Promise.resolve(ok(active)),

    saveActive: (session) => {
      active = session;
      return Promise.resolve(ok(session));
    },

    discardActive: () => {
      active = null;
      return Promise.resolve(ok(undefined));
    },

    complete: (session, durationSeconds) => {
      const result: WorkoutResult = {
        id: nextId('workout'),
        athleteId: session.athleteId,
        workoutSessionId: session.workoutDayId,
        completedAt: new Date().toISOString(),
        durationSeconds,
        rpe: session.rpe,
        notes: session.notes.trim().length > 0 ? session.notes.trim() : null,
        distanceMeters: session.entries.reduce(
          (total, entry) => total + (entry.distanceMeters ?? 0),
          0,
        ),
      };

      exerciseResults = [
        ...exerciseResults,
        ...session.entries.map((entry) => ({
          id: nextId('exercise'),
          workoutResultId: result.id,
          workoutBlockId: entry.blockId,
          repIndex: entry.repIndex,
          ...(entry.durationSeconds !== undefined
            ? { durationSeconds: entry.durationSeconds }
            : {}),
          ...(entry.distanceMeters !== undefined
            ? { distanceMeters: entry.distanceMeters }
            : {}),
          ...(entry.reps !== undefined ? { reps: entry.reps } : {}),
          ...(entry.loadPounds !== undefined ? { loadPounds: entry.loadPounds } : {}),
          ...(entry.rpe !== undefined ? { rpe: entry.rpe } : {}),
        })),
      ];

      results = [...results, result];
      active = null;
      return Promise.resolve(ok(result));
    },

    listResults: (_athleteId, options) => {
      const newestFirst = [...results].sort((a, b) =>
        b.completedAt.localeCompare(a.completedAt),
      );
      return Promise.resolve(
        ok(options?.limit ? newestFirst.slice(0, options.limit) : newestFirst),
      );
    },

    listExerciseResults: (workoutResultId) =>
      Promise.resolve(
        ok(exerciseResults.filter((row) => row.workoutResultId === workoutResultId)),
      ),
  };
}
