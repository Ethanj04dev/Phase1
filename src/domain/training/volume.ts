import type { IsoDateTime } from '@/domain/types';

import type { WorkoutResult } from './types';

/**
 * Weekly training volume and consistency, bucketed by programme week.
 *
 * Programme weeks rather than calendar weeks, so the chart lines up with the
 * deload the athlete can see in their plan. A calendar week would split every
 * block across two bars and make the periodisation invisible.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface WeeklyVolume {
  weekNumber: number;
  weekStart: IsoDateTime;
  /** Metres logged across every session that week. */
  distanceMeters: number;
  /** Sessions completed that week. */
  sessions: number;
  durationSeconds: number;
}

function startOfLocalDay(iso: IsoDateTime): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * One bucket per programme week, including weeks with no training.
 *
 * Empty weeks are kept rather than skipped: a gap in the chart is information,
 * and collapsing it would make a missed week look like it never existed.
 */
export function weeklyVolume(
  results: readonly WorkoutResult[],
  programStart: IsoDateTime,
  durationWeeks: number,
): WeeklyVolume[] {
  const start = startOfLocalDay(programStart);
  if (start === null || durationWeeks <= 0) {
    return [];
  }

  const buckets: WeeklyVolume[] = Array.from({ length: durationWeeks }, (_, index) => ({
    weekNumber: index + 1,
    weekStart: new Date(start + index * MS_PER_WEEK).toISOString(),
    distanceMeters: 0,
    sessions: 0,
    durationSeconds: 0,
  }));

  for (const result of results) {
    const completed = startOfLocalDay(result.completedAt);
    if (completed === null || completed < start) {
      continue;
    }
    const weekIndex = Math.floor((completed - start) / MS_PER_WEEK);
    const bucket = buckets[weekIndex];
    if (!bucket) {
      continue; // Completed after the programme ended.
    }
    bucket.distanceMeters += result.distanceMeters ?? 0;
    bucket.durationSeconds += result.durationSeconds;
    bucket.sessions += 1;
  }

  return buckets;
}

/** Weeks up to and including the athlete's current position. */
export function volumeToDate(
  buckets: readonly WeeklyVolume[],
  currentWeek: number,
): WeeklyVolume[] {
  return buckets.filter((bucket) => bucket.weekNumber <= currentWeek);
}

export function totalDistance(buckets: readonly WeeklyVolume[]): number {
  return buckets.reduce((total, bucket) => total + bucket.distanceMeters, 0);
}

export function totalSessions(buckets: readonly WeeklyVolume[]): number {
  return buckets.reduce((total, bucket) => total + bucket.sessions, 0);
}
