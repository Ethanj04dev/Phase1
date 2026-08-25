import type { AthleteProfile } from '@/domain/athlete/types';
import { streakDays, weeklyCompletion, weekStartFor } from '@/domain/training/consistency';
import { positionFor } from '@/domain/training/schedule';
import type { ResolvedWorkoutDay } from '@/domain/training/types';
import { err, ok, type Result } from '@/domain/types';

import type {
  ProgramPosition,
  ProgramSummary,
  TrainingRepository,
  WorkoutRepository,
} from '@/data/repositories/types';

import { dayKey } from './buildProgram';
import { programForTrack } from './programs';

/**
 * Training repository backed by authored programme content.
 *
 * Programme content is not athlete data: it is authored, versioned with the
 * app, and identical for everyone on a track. Only the athlete's *position* in
 * it is personal, and that is derived from when they started.
 */

const NO_PROFILE = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

type ProfileLoader = () => Promise<Result<AthleteProfile | null>>;

export function createContentTrainingRepository(
  getProfile: ProfileLoader,
  workouts: WorkoutRepository,
  now: () => string = () => new Date().toISOString(),
): TrainingRepository {
  /** Completion instants of every finished workout. */
  async function completedTimestamps(): Promise<Result<readonly string[]>> {
    const profileResult = await getProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    if (!profileResult.value) {
      return ok([]);
    }
    const results = await workouts.listResults(profileResult.value.id);
    return results.ok ? ok(results.value.map((r) => r.completedAt)) : results;
  }

  /** Resolves the athlete, their programme and where they are in it. */
  async function context() {
    const profileResult = await getProfile();
    if (!profileResult.ok) {
      return { ok: false as const, error: profileResult.error };
    }
    const profile = profileResult.value;
    if (!profile) {
      return { ok: false as const, error: NO_PROFILE };
    }

    const built = programForTrack(profile.trackId);
    const position = positionFor(
      profile.createdAt,
      now(),
      built.program.durationWeeks,
    );

    return { ok: true as const, profile, built, position };
  }

  return {
    getProgram: async (): Promise<Result<ProgramSummary | null>> => {
      const resolved = await context();
      if (!resolved.ok) {
        return err(resolved.error);
      }
      return ok({ program: resolved.built.program, weekFocus: resolved.built.weekFocus });
    },

    getPosition: async (): Promise<Result<ProgramPosition | null>> => {
      const resolved = await context();
      if (!resolved.ok) {
        return err(resolved.error);
      }
      const { position, built } = resolved;
      if (!position) {
        return ok(null);
      }
      return ok({
        weekNumber: position.weekNumber,
        dayNumber: position.dayNumber,
        weekFocus: built.weekFocus.get(position.weekNumber) ?? '',
      });
    },

    getToday: async (): Promise<Result<ResolvedWorkoutDay | null>> => {
      const resolved = await context();
      if (!resolved.ok) {
        return err(resolved.error);
      }
      const { position, built } = resolved;
      if (!position) {
        return ok(null);
      }
      return ok(built.days.get(dayKey(position.weekNumber, position.dayNumber)) ?? null);
    },

    getWeek: async (_athleteId, weekNumber) => {
      const resolved = await context();
      if (!resolved.ok) {
        return err(resolved.error);
      }
      const { built } = resolved;
      if (weekNumber < 1 || weekNumber > built.program.durationWeeks) {
        return ok([]);
      }
      const days = Array.from({ length: 7 }, (_, index) =>
        built.days.get(dayKey(weekNumber, index + 1)),
      ).filter((day): day is ResolvedWorkoutDay => day !== undefined);
      return ok(days);
    },

    getDay: async (_athleteId, dayId) => {
      const resolved = await context();
      if (!resolved.ok) {
        return err(resolved.error);
      }
      for (const day of resolved.built.days.values()) {
        if (day.id === dayId) {
          return ok(day);
        }
      }
      return ok(null);
    },

    // Both describe what this athlete actually did, so both are computed from
    // finished workouts rather than from authored content.
    getStreakDays: async () => {
      const completed = await completedTimestamps();
      if (!completed.ok) {
        return completed;
      }
      return ok(streakDays(completed.value, now()));
    },

    getWeeklyCompletion: async () => {
      const resolved = await context();
      if (!resolved.ok) {
        return err(resolved.error);
      }
      const completed = await completedTimestamps();
      if (!completed.ok) {
        return completed;
      }

      const { position, built, profile } = resolved;
      if (!position) {
        return ok(0);
      }

      const weekStart = weekStartFor(profile.createdAt, position.weekNumber);
      if (!weekStart) {
        return ok(0);
      }

      // Rest days are excluded from the denominator, so a fully compliant week
      // reads 100 percent rather than being capped by the calendar.
      const trainingDays = Array.from({ length: 7 }, (_, index) =>
        built.days.get(dayKey(position.weekNumber, index + 1)),
      ).filter((day) => day && !day.restDay).length;

      return ok(weeklyCompletion(completed.value, weekStart, trainingDays));
    },
  };
}
