import type { CategoryScores } from '@/domain/types';

import {
  baselineWithin,
  biggestDecline,
  biggestGain,
  categoryMovement,
  domainMovement,
} from './movement';
import type { DomainScores } from './pipelineScore';
import type { ReadinessSnapshot } from './types';

function snapshot(
  recordedAt: string,
  overall: number,
  categories: CategoryScores,
): ReadinessSnapshot {
  return {
    id: recordedAt,
    athleteId: 'a',
    recordedAt,
    overall,
    categories,
    strongestCategory: null,
    priorityCategory: null,
    coverage: 1,
    benchmarkVersion: 1,
    target: null,
  };
}

const EARLIER = snapshot('2026-08-01T00:00:00.000Z', 58, {
  running: 62,
  swimming: 47,
  calisthenics: 60,
  rucking: 55,
});

const LATEST = snapshot('2026-08-25T00:00:00.000Z', 64, {
  running: 72,
  swimming: 45,
  calisthenics: 66,
  rucking: 55,
});

describe('categoryMovement', () => {
  it('is empty without a latest snapshot', () => {
    expect(categoryMovement(null, EARLIER)).toEqual([]);
  });

  it('reports a signed delta per category', () => {
    const movements = categoryMovement(LATEST, EARLIER);
    const byCategory = new Map(movements.map((m) => [m.key, m]));
    expect(byCategory.get('running')?.delta).toBe(10);
    expect(byCategory.get('swimming')?.delta).toBe(-2);
    expect(byCategory.get('rucking')?.delta).toBe(0);
  });

  it('reports a null delta with nothing to compare against', () => {
    const movements = categoryMovement(LATEST, null);
    expect(movements.every((m) => m.delta === null)).toBe(true);
    expect(movements).toHaveLength(4);
  });

  it('skips categories the latest snapshot never scored', () => {
    const partial = snapshot('2026-08-25T00:00:00.000Z', 70, { running: 72 });
    const movements = categoryMovement(partial, EARLIER);
    expect(movements).toHaveLength(1);
    expect(movements[0]?.key).toBe('running');
  });

  it('handles a category that is new since the earlier snapshot', () => {
    const before = snapshot('2026-08-01T00:00:00.000Z', 60, { running: 62 });
    const movements = categoryMovement(LATEST, before);
    const swimming = movements.find((m) => m.key === 'swimming');
    expect(swimming?.previous).toBeNull();
    expect(swimming?.delta).toBeNull();
  });
});

describe('biggestGain and biggestDecline', () => {
  const movements = categoryMovement(LATEST, EARLIER);

  it('finds the largest improvement', () => {
    expect(biggestGain(movements)?.key).toBe('running');
    expect(biggestGain(movements)?.delta).toBe(10);
  });

  // An athlete whose swim slipped while everything else improved needs telling.
  it('finds the largest decline', () => {
    expect(biggestDecline(movements)?.key).toBe('swimming');
    expect(biggestDecline(movements)?.delta).toBe(-2);
  });

  it('returns null when nothing moved in that direction', () => {
    const flat = categoryMovement(EARLIER, EARLIER);
    expect(biggestGain(flat)).toBeNull();
    expect(biggestDecline(flat)).toBeNull();
  });

  it('ignores categories with no comparison', () => {
    expect(biggestGain(categoryMovement(LATEST, null))).toBeNull();
    expect(biggestDecline(categoryMovement(LATEST, null))).toBeNull();
  });
});

describe('baselineWithin', () => {
  const now = '2026-08-25T00:00:00.000Z';

  it('returns null with no history', () => {
    expect(baselineWithin([], 30, now)).toBeNull();
  });

  it('returns null when only one snapshot is in the window', () => {
    expect(baselineWithin([LATEST], 30, now)).toBeNull();
  });

  it('returns the oldest snapshot inside the window', () => {
    const old = snapshot('2026-01-01T00:00:00.000Z', 30, { running: 40 });
    const baseline = baselineWithin([old, EARLIER, LATEST], 30, now);
    expect(baseline?.id).toBe(EARLIER.id);
  });

  it('is unaffected by input ordering', () => {
    const ordered = [EARLIER, LATEST];
    expect(baselineWithin(ordered, 30, now)?.id).toBe(
      baselineWithin([...ordered].reverse(), 30, now)?.id,
    );
  });
});

// --- Domain movement --------------------------------------------------------

function targetSnapshot(
  recordedAt: string,
  targetId: string,
  domains: DomainScores,
): ReadinessSnapshot {
  return {
    ...snapshot(recordedAt, 0, {}),
    target: {
      targetId,
      overall: 0,
      domains,
      strongestDomain: null,
      priorityDomain: null,
      coverage: 1,
    },
  };
}

describe('domain movement', () => {
  const EARLIER_PJ = targetSnapshot('2026-08-01T00:00:00.000Z', 'pararescue', {
    swimming: 40,
    running: 70,
  });
  const LATER_PJ = targetSnapshot('2026-08-20T00:00:00.000Z', 'pararescue', {
    swimming: 55,
    running: 64,
    water_confidence: 63,
  });

  it('reports the change in each domain', () => {
    const movements = domainMovement(LATER_PJ, EARLIER_PJ);
    expect(movements.find((m) => m.key === 'swimming')?.delta).toBe(15);
    expect(movements.find((m) => m.key === 'running')?.delta).toBe(-6);
  });

  it('reports a newly measured domain as having nothing to compare against', () => {
    const water = domainMovement(LATER_PJ, EARLIER_PJ).find(
      (m) => m.key === 'water_confidence',
    );
    expect(water?.previous).toBeNull();
    expect(water?.delta).toBeNull();
  });

  // Changing career changes what is measured, not the athlete.
  it('refuses to compare across different targets', () => {
    const earlierOther = targetSnapshot('2026-08-01T00:00:00.000Z', 'other_career', {
      swimming: 90,
    });
    for (const movement of domainMovement(LATER_PJ, earlierOther)) {
      expect(movement.delta).toBeNull();
    }
  });

  it('returns nothing when the latest snapshot has no target score', () => {
    expect(domainMovement(EARLIER, EARLIER_PJ)).toEqual([]);
  });

  it('finds the biggest gain and the biggest decline', () => {
    const movements = domainMovement(LATER_PJ, EARLIER_PJ);
    expect(biggestGain(movements)?.key).toBe('swimming');
    expect(biggestDecline(movements)?.key).toBe('running');
  });
});
