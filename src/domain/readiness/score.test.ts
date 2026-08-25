import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import { ASSESSMENT_EVENTS } from '@/domain/assessment/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { PERFORMANCE_CATEGORIES } from '@/domain/types';

import { BENCHMARKS, BENCHMARK_VERSION } from './benchmarks';
import {
  calculateReadiness,
  calculateTrend,
  interpolateScore,
  scoreCategories,
  scoreEvent,
} from './score';
import type { ReadinessSnapshot } from './types';

let idCounter = 0;

function result(
  eventId: AssessmentEventId,
  value: number,
  recordedAt = '2026-08-01T00:00:00.000Z',
): AssessmentResult {
  idCounter += 1;
  return {
    id: `result-${idCounter}`,
    athleteId: 'athlete-1',
    eventId,
    value,
    recordedAt,
    notes: null,
  };
}

function snapshot(overall: number, recordedAt: string): ReadinessSnapshot {
  return {
    id: `snapshot-${recordedAt}`,
    athleteId: 'athlete-1',
    recordedAt,
    overall,
    categories: {},
    strongestCategory: null,
    priorityCategory: null,
    coverage: 1,
    benchmarkVersion: BENCHMARK_VERSION,
  };
}

describe('benchmark tables', () => {
  it('defines a table for every assessment event', () => {
    for (const event of ASSESSMENT_EVENTS) {
      expect(BENCHMARKS[event.id]?.length ?? 0).toBeGreaterThan(1);
    }
  });

  it.each(ASSESSMENT_EVENTS.map((e) => [e.id, e] as const))(
    '%s anchors ascend in score and run monotonically in value',
    (eventId, event) => {
      const anchors = BENCHMARKS[eventId];
      const first = anchors[0];
      const last = anchors[anchors.length - 1];
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      if (!first || !last) return;

      for (let i = 1; i < anchors.length; i += 1) {
        const prev = anchors[i - 1];
        const curr = anchors[i];
        if (!prev || !curr) continue;
        expect(curr.score).toBeGreaterThan(prev.score);

        // Value must move in the direction the event improves.
        if (event.direction === 'lower_is_better') {
          expect(curr.value).toBeLessThan(prev.value);
        } else {
          expect(curr.value).toBeGreaterThan(prev.value);
        }
      }

      expect(first.score).toBe(0);
      expect(last.score).toBe(100);
    },
  );
});

describe('interpolateScore', () => {
  const ascending = [
    { value: 0, score: 0 },
    { value: 10, score: 50 },
    { value: 20, score: 100 },
  ];

  it('returns anchor scores exactly at anchor values', () => {
    expect(interpolateScore(ascending, 0)).toBe(0);
    expect(interpolateScore(ascending, 10)).toBe(50);
    expect(interpolateScore(ascending, 20)).toBe(100);
  });

  it('interpolates linearly between anchors', () => {
    expect(interpolateScore(ascending, 5)).toBe(25);
    expect(interpolateScore(ascending, 15)).toBe(75);
  });

  it('clamps outside the table instead of extrapolating', () => {
    expect(interpolateScore(ascending, -50)).toBe(0);
    expect(interpolateScore(ascending, 1000)).toBe(100);
  });

  it('handles descending tables where lower values score higher', () => {
    const descending = [
      { value: 600, score: 0 },
      { value: 500, score: 50 },
      { value: 400, score: 100 },
    ];
    expect(interpolateScore(descending, 600)).toBe(0);
    expect(interpolateScore(descending, 550)).toBe(25);
    expect(interpolateScore(descending, 400)).toBe(100);
    expect(interpolateScore(descending, 300)).toBe(100); // faster than the table
    expect(interpolateScore(descending, 900)).toBe(0); // slower than the table
  });

  it('floors non-finite input rather than returning NaN or a perfect score', () => {
    // Corrupt input must never be rewarded. Infinity is not a performance, and
    // awarding 100 for it would let an upstream bug silently inflate readiness.
    expect(interpolateScore(ascending, Number.NaN)).toBe(0);
    expect(interpolateScore(ascending, Number.POSITIVE_INFINITY)).toBe(0);
    expect(interpolateScore(ascending, Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('scoreEvent monotonicity', () => {
  // The property that matters most: training harder must never lower a score.
  it('never decreases as repetitions increase', () => {
    let previous = -1;
    for (let reps = 0; reps <= 40; reps += 1) {
      const score = scoreEvent('pull_ups', reps);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('never decreases as run time falls', () => {
    let previous = -1;
    for (let seconds = 700; seconds >= 300; seconds -= 5) {
      const score = scoreEvent('run_1_5_mile', seconds);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('never decreases as swim time falls', () => {
    let previous = -1;
    for (let seconds = 1000; seconds >= 400; seconds -= 10) {
      const score = scoreEvent('swim_500m', seconds);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('keeps every score within range across the full input domain', () => {
    for (const event of ASSESSMENT_EVENTS) {
      for (const value of [-1000, 0, 1, 50, 500, 5000, 100000]) {
        const score = scoreEvent(event.id, value);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('scoreCategories', () => {
  it('averages the events within a category', () => {
    // pull-ups 10 -> 50, push-ups 45 -> 50, sit-ups 50 -> 50
    const categories = scoreCategories([
      result('pull_ups', 10),
      result('push_ups', 45),
      result('sit_ups', 50),
    ]);
    expect(categories.calisthenics).toBe(50);
  });

  it('omits categories with no results rather than scoring them zero', () => {
    const categories = scoreCategories([result('pull_ups', 10)]);
    expect(categories.calisthenics).toBeDefined();
    expect(categories.swimming).toBeUndefined();
    expect(categories.running).toBeUndefined();
  });

  it('scores only the most recent result for an event', () => {
    const categories = scoreCategories([
      result('pull_ups', 5, '2026-01-01T00:00:00.000Z'),
      result('pull_ups', 20, '2026-06-01T00:00:00.000Z'),
    ]);
    // Latest is 20 reps -> 85, not the older 5 reps -> 25.
    expect(categories.calisthenics).toBe(85);
  });

  it('uses the latest result even when history is out of order', () => {
    const categories = scoreCategories([
      result('pull_ups', 20, '2026-06-01T00:00:00.000Z'),
      result('pull_ups', 5, '2026-01-01T00:00:00.000Z'),
    ]);
    expect(categories.calisthenics).toBe(85);
  });

  it('returns an empty map for no results', () => {
    expect(scoreCategories([])).toEqual({});
  });
});

describe('calculateReadiness', () => {
  const seal = getGoalOrDefault('navy_seal');

  it('returns null when nothing has been tested', () => {
    expect(calculateReadiness(seal, [])).toBeNull();
  });

  it('reports coverage as the share of goal weight backed by data', () => {
    // Only calisthenics tested. For a SEAL goal that category weighs 0.28.
    const calculation = calculateReadiness(seal, [result('pull_ups', 10)]);
    expect(calculation).not.toBeNull();
    expect(calculation?.coverage).toBeCloseTo(0.28, 5);
  });

  it('reaches full coverage when every category has data', () => {
    const calculation = calculateReadiness(seal, [
      result('pull_ups', 10),
      result('run_1_mile', 420),
      result('swim_500m', 630),
      result('ruck_3_mile', 2700),
    ]);
    // All four scored categories have an assessment event, so a complete
    // battery is genuinely reachable.
    expect(calculation?.coverage).toBeCloseTo(1, 5);
  });

  it('renormalises weights so untested categories are not implicit zeros', () => {
    // A single perfect category should yield a perfect overall score, not a
    // score dragged down by the categories that were never tested.
    const calculation = calculateReadiness(seal, [result('swim_500m', 450)]);
    expect(calculation?.categories.swimming).toBe(100);
    expect(calculation?.overall).toBe(100);
  });

  it('weights categories by the goal emphasis', () => {
    const results = [
      result('swim_500m', 450), // swimming 100
      result('ruck_3_mile', 3600), // rucking 0
    ];

    // SEAL weights swimming 0.33 and rucking 0.11, so the score leans high.
    const sealScore = calculateReadiness(seal, results)?.overall ?? 0;
    // Special Forces weights rucking 0.44 and swimming 0.06, so it leans low.
    const sf = getGoalOrDefault('army_special_forces');
    const sfScore = calculateReadiness(sf, results)?.overall ?? 0;

    expect(sealScore).toBeGreaterThan(sfScore);
    expect(sealScore).toBe(75); // 100*0.33 / (0.33+0.11)
    expect(sfScore).toBe(12); // 100*0.06 / (0.06+0.44)
  });

  it('identifies the strongest category', () => {
    const calculation = calculateReadiness(seal, [
      result('swim_500m', 450), // 100
      result('run_1_mile', 600), // 0
    ]);
    expect(calculation?.strongestCategory).toBe('swimming');
  });

  it('picks priority by weighted headroom, not raw weakness', () => {
    const calculation = calculateReadiness(seal, [
      // swimming 70, weight 0.33 -> headroom 9.9
      result('swim_500m', 570),
      // rucking 65, weight 0.11 -> headroom 3.9
      result('ruck_3_mile', 2700),
    ]);
    // Rucking scores lower, but improving swimming moves the needle more.
    expect(calculation?.categories.rucking).toBeLessThan(calculation?.categories.swimming ?? 0);
    expect(calculation?.priorityCategory).toBe('swimming');
  });

  it('stamps the benchmark version so old scores stay interpretable', () => {
    const calculation = calculateReadiness(seal, [result('pull_ups', 10)]);
    expect(calculation?.benchmarkVersion).toBe(BENCHMARK_VERSION);
  });

  it('produces a score within range for every goal', () => {
    const results = [
      result('pull_ups', 12),
      result('push_ups', 55),
      result('sit_ups', 60),
      result('run_1_5_mile', 660),
      result('swim_500m', 600),
      result('ruck_3_mile', 2800),
    ];

    for (const category of PERFORMANCE_CATEGORIES) {
      expect(PERFORMANCE_CATEGORIES).toContain(category);
    }

    for (const goalId of ['pararescue', 'navy_seal', 'army_ranger', 'general_selection']) {
      const calculation = calculateReadiness(getGoalOrDefault(goalId as never), results);
      expect(calculation).not.toBeNull();
      expect(calculation?.overall).toBeGreaterThanOrEqual(0);
      expect(calculation?.overall).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic', () => {
    const results = [result('pull_ups', 14), result('swim_500m', 620)];
    expect(calculateReadiness(seal, results)).toEqual(calculateReadiness(seal, results));
  });
});

describe('calculateTrend', () => {
  const now = '2026-08-25T00:00:00.000Z';

  it('returns null with no history', () => {
    expect(calculateTrend([], 30, now)).toBeNull();
  });

  it('reports no comparison when only one snapshot exists', () => {
    const trend = calculateTrend([snapshot(70, '2026-08-20T00:00:00.000Z')], 30, now);
    expect(trend).toEqual({ delta: 0, windowDays: 30, comparedTo: null });
  });

  it('measures newest against the oldest snapshot inside the window', () => {
    const trend = calculateTrend(
      [
        snapshot(60, '2026-08-01T00:00:00.000Z'),
        snapshot(66, '2026-08-12T00:00:00.000Z'),
        snapshot(72, '2026-08-24T00:00:00.000Z'),
      ],
      30,
      now,
    );
    expect(trend?.delta).toBe(12);
    expect(trend?.comparedTo).toBe('2026-08-01T00:00:00.000Z');
  });

  it('ignores snapshots older than the window', () => {
    const trend = calculateTrend(
      [
        snapshot(20, '2026-01-01T00:00:00.000Z'), // far outside 30 days
        snapshot(66, '2026-08-12T00:00:00.000Z'),
        snapshot(72, '2026-08-24T00:00:00.000Z'),
      ],
      30,
      now,
    );
    expect(trend?.delta).toBe(6);
    expect(trend?.comparedTo).toBe('2026-08-12T00:00:00.000Z');
  });

  it('reports a negative delta when readiness falls', () => {
    const trend = calculateTrend(
      [snapshot(80, '2026-08-05T00:00:00.000Z'), snapshot(74, '2026-08-24T00:00:00.000Z')],
      30,
      now,
    );
    expect(trend?.delta).toBe(-6);
  });

  it('does not depend on input ordering', () => {
    const ordered = [
      snapshot(60, '2026-08-01T00:00:00.000Z'),
      snapshot(72, '2026-08-24T00:00:00.000Z'),
    ];
    expect(calculateTrend(ordered, 30, now)).toEqual(
      calculateTrend([...ordered].reverse(), 30, now),
    );
  });
});
