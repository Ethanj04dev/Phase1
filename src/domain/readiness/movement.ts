import { PREPARATION_DOMAINS, type PreparationDomainId } from '@/domain/target/domains';
import { PERFORMANCE_CATEGORIES, type PerformanceCategory } from '@/domain/types';

import type { ReadinessSnapshot } from './types';

/**
 * How each score has moved between two readiness snapshots.
 *
 * The comparison is against a chosen earlier snapshot rather than "the one
 * before", so the UI can ask a meaningful question -- how am I doing this
 * month -- instead of reporting the noise between two adjacent tests.
 *
 * Generic over the key because the same arithmetic now serves two scales: the
 * legacy goal categories and the Target's preparation domains. Sharing the
 * comparison rather than copying it is what stops the two drifting apart.
 */

export interface ScoreMovement<K extends string> {
  key: K;
  current: number;
  /** Null when the key had no score in the earlier snapshot. */
  previous: number | null;
  /** Signed change. Null when there is nothing to compare against. */
  delta: number | null;
}

export type CategoryMovement = ScoreMovement<PerformanceCategory>;
export type DomainMovement = ScoreMovement<PreparationDomainId>;

function movementOver<K extends string>(
  keys: readonly K[],
  current: Partial<Record<K, number>>,
  earlier: Partial<Record<K, number>> | null,
): ScoreMovement<K>[] {
  return keys.flatMap((key) => {
    const now = current[key];
    if (now === undefined) {
      return [];
    }
    const previous = earlier?.[key] ?? null;
    return [{ key, current: now, previous, delta: previous === null ? null : now - previous }];
  });
}

export function categoryMovement(
  latest: ReadinessSnapshot | null,
  earlier: ReadinessSnapshot | null,
): CategoryMovement[] {
  if (!latest) {
    return [];
  }
  return movementOver(
    PERFORMANCE_CATEGORIES,
    latest.categories,
    earlier?.categories ?? null,
  );
}

/**
 * Domain movement, compared only against a snapshot scored on the same Target.
 *
 * Comparing across Targets would report a change in what is being measured as
 * though it were a change in the athlete. Someone who switches career and sees
 * their swim "drop" has not got slower.
 */
export function domainMovement(
  latest: ReadinessSnapshot | null,
  earlier: ReadinessSnapshot | null,
): DomainMovement[] {
  if (!latest?.target) {
    return [];
  }
  const comparable =
    earlier?.target && earlier.target.targetId === latest.target.targetId
      ? earlier.target.domains
      : null;

  return movementOver(PREPARATION_DOMAINS, latest.target.domains, comparable);
}

/** Largest gain, or null when nothing improved. */
export function biggestGain<K extends string>(
  movements: readonly ScoreMovement<K>[],
): ScoreMovement<K> | null {
  let best: ScoreMovement<K> | null = null;
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
export function biggestDecline<K extends string>(
  movements: readonly ScoreMovement<K>[],
): ScoreMovement<K> | null {
  let worst: ScoreMovement<K> | null = null;
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

  const chronological = [...history].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const newest = chronological[chronological.length - 1];
  const candidate = chronological.find((snapshot) => Date.parse(snapshot.recordedAt) >= cutoff);

  // A single snapshot inside the window has nothing to compare against.
  return candidate && candidate !== newest ? candidate : null;
}
