import {
  PERFORMANCE_CATEGORIES,
  type PerformanceCategory,
} from '@/domain/types';

import type { ReadinessSnapshot } from './types';

/**
 * How each category has moved between two readiness snapshots.
 *
 * The comparison is against a chosen earlier snapshot rather than "the one
 * before", so the UI can ask a meaningful question -- how am I doing this
 * month -- instead of reporting the noise between two adjacent tests.
 */

export interface CategoryMovement {
  category: PerformanceCategory;
  current: number;
  /** Null when the category had no score in the earlier snapshot. */
  previous: number | null;
  /** Signed change. Null when there is nothing to compare against. */
  delta: number | null;
}

export function categoryMovement(
  latest: ReadinessSnapshot | null,
  earlier: ReadinessSnapshot | null,
): CategoryMovement[] {
  if (!latest) {
    return [];
  }

  return PERFORMANCE_CATEGORIES.flatMap((category) => {
    const current = latest.categories[category];
    if (current === undefined) {
      return [];
    }
    const previous = earlier?.categories[category] ?? null;
    return [
      {
        category,
        current,
        previous,
        delta: previous === null ? null : current - previous,
      },
    ];
  });
}

/** Largest gain, or null when nothing improved. */
export function biggestGain(movements: readonly CategoryMovement[]): CategoryMovement | null {
  let best: CategoryMovement | null = null;
  for (const movement of movements) {
    if (movement.delta === null || movement.delta <= 0) {
      continue;
    }
    if (best === null || movement.delta > (best.delta ?? 0)) {
      best = movement;
    }
  }
  return best;
}

/**
 * Largest decline, or null when nothing fell.
 *
 * Surfaced deliberately. An athlete whose swim has slipped while everything
 * else improved needs to be told, not shielded from it.
 */
export function biggestDecline(
  movements: readonly CategoryMovement[],
): CategoryMovement | null {
  let worst: CategoryMovement | null = null;
  for (const movement of movements) {
    if (movement.delta === null || movement.delta >= 0) {
      continue;
    }
    if (worst === null || movement.delta < (worst.delta ?? 0)) {
      worst = movement;
    }
  }
  return worst;
}

/**
 * The oldest snapshot at or after the cutoff, which is what a "last 30 days"
 * comparison should measure against.
 */
export function baselineWithin(
  history: readonly ReadinessSnapshot[],
  windowDays: number,
  now: string,
): ReadinessSnapshot | null {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs) || history.length === 0) {
    return null;
  }
  const cutoff = nowMs - windowDays * 24 * 60 * 60 * 1000;

  const chronological = [...history].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt),
  );
  const newest = chronological[chronological.length - 1];
  const candidate = chronological.find(
    (snapshot) => Date.parse(snapshot.recordedAt) >= cutoff,
  );

  // A single snapshot inside the window has nothing to compare against.
  return candidate && candidate !== newest ? candidate : null;
}
