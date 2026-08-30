import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import { PARARESCUE } from '@/data/content/pipelines';
import { calculatePipelineReadiness } from '@/domain/readiness/pipelineScore';

import { buildRoadToReady } from './roadToReady';
import { findDomain } from './types';

let counter = 0;
function result(eventId: AssessmentEventId, value: number): AssessmentResult {
  counter += 1;
  return {
    id: `r${counter}`,
    athleteId: 'a',
    eventId,
    value,
    recordedAt: '2026-08-01T00:00:00.000Z',
    notes: null,
  };
}

function roadFor(results: readonly AssessmentResult[]) {
  const readiness = calculatePipelineReadiness(PARARESCUE, { results });
  return buildRoadToReady(PARARESCUE, readiness, results);
}

function stepFor(results: readonly AssessmentResult[], domainId: string) {
  return roadFor(results).steps.find((step) => step.domainId === domainId);
}

/**
 * Strong everywhere except the swim: 11:00 against a 9:30 benchmark scores 48,
 * which is behind but not bottomed out. A zero here would make the fixture
 * prove less, because full headroom wins every comparison trivially.
 */
const SWIM_WEAK: readonly AssessmentResult[] = [
  result('pull_ups', 21),
  result('push_ups', 78),
  result('sit_ups', 84),
  result('run_1_5_mile', 555),
  result('ruck_3_mile', 2460),
  result('swim_500m', 660),
];

describe('road to ready', () => {
  it('covers every domain the target defines, once each', () => {
    const road = roadFor(SWIM_WEAK);
    expect(road.steps).toHaveLength(PARARESCUE.domains.length);
    expect(new Set(road.steps.map((s) => s.domainId)).size).toBe(road.steps.length);
  });

  it('orders by impact, highest first', () => {
    const impacts = roadFor(SWIM_WEAK).steps.map((step) => step.impact);
    const sorted = [...impacts].sort((a, b) => b - a);
    expect(impacts).toEqual(sorted);
  });

  // The reason this engine exists rather than a "lowest score wins" sort.
  it('ranks a weakness the target cares about above one it does not', () => {
    // Rucking scores 21 against swimming's 48 -- more than twice as weak in
    // raw terms. But swimming is 22% of this Target and rucking is 10%, so
    // the swim is still where the score is. A "lowest score first" list would
    // send this athlete rucking.
    const results = [
      ...SWIM_WEAK.filter((r) => r.eventId !== 'ruck_3_mile'),
      result('ruck_3_mile', 3300),
    ];
    const road = roadFor(results);
    const swim = road.steps.findIndex((s) => s.domainId === 'swimming');
    const ruck = road.steps.findIndex((s) => s.domainId === 'rucking');
    const readiness = calculatePipelineReadiness(PARARESCUE, { results });

    expect(readiness?.domains.rucking).toBeLessThan(readiness?.domains.swimming ?? 0);
    expect(swim).toBeLessThan(ruck);
  });

  it('agrees with the readiness engine about the priority domain', () => {
    const readiness = calculatePipelineReadiness(PARARESCUE, { results: SWIM_WEAK });
    const road = buildRoadToReady(PARARESCUE, readiness, SWIM_WEAK);
    // Both rank by weighted headroom; if they ever diverge, the Target screen
    // and the Road screen would give contradictory advice on the same data.
    const measured = road.steps.filter((step) => step.kind !== 'measure' && step.kind !== 'unavailable');
    expect(measured[0]?.domainId).toBe(readiness?.priorityDomain);
  });
});

describe('unmeasured is not the same as weak', () => {
  it('asks the athlete to measure rather than to train harder', () => {
    const step = stepFor(SWIM_WEAK, 'water_confidence');
    expect(step?.kind).toBe('measure');
    expect(step?.score).toBeNull();
  });

  it('puts an unmeasured domain ahead of a measured weakness of similar weight', () => {
    // Water confidence (.20, never measured) against swimming (.22, scored 48
    // and the worst thing on the board). The unknown still leads, because an
    // unmeasured domain carries its full headroom.
    const road = roadFor(SWIM_WEAK);
    const water = road.steps.findIndex((s) => s.domainId === 'water_confidence');
    const swim = road.steps.findIndex((s) => s.domainId === 'swimming');
    expect(water).toBeLessThan(swim);
  });

  it('reports unmeasured weight so the score can be read with suspicion', () => {
    const road = roadFor(SWIM_WEAK);
    const water = findDomain(PARARESCUE, 'water_confidence')?.weight ?? 0;
    const consistency = findDomain(PARARESCUE, 'training_consistency')?.weight ?? 0;
    expect(road.unmeasuredWeight).toBeCloseTo(water + consistency, 5);
  });

  // Consistency has no assessment event, but it is not unmeasurable: the way
  // to score it is to train, and calling it unavailable would be a lie.
  it('treats a behavioural domain as measurable, not unavailable', () => {
    expect(stepFor(SWIM_WEAK, 'training_consistency')?.kind).toBe('measure');
  });
});

describe('a domain with no safe assessment says so', () => {
  it('marks strength unavailable rather than dropping or zeroing it', () => {
    const step = stepFor(SWIM_WEAK, 'strength');
    expect(step?.kind).toBe('unavailable');
    expect(step?.score).toBeNull();
    expect(step?.impact).toBe(0);
  });

  it('never becomes the focus', () => {
    // Even with nothing else measured, an unmeasurable domain must not be the
    // instruction, because there is no action behind it.
    const road = roadFor([]);
    expect(road.focus?.domainId).not.toBe('strength');
  });
});

describe('event gaps', () => {
  it('reads time events in the right direction', () => {
    // 11:00 against a 9:30 benchmark is 1:30 short, not 1:30 ahead.
    const step = stepFor(SWIM_WEAK, 'swimming');
    const swim = step?.events.find((e) => e.eventId === 'swim_500m');
    expect(swim?.met).toBe(false);
    expect(swim?.gap).toBe(660 - 570);
  });

  it('reads rep events in the right direction', () => {
    const step = stepFor(SWIM_WEAK, 'calisthenics');
    const pull = step?.events.find((e) => e.eventId === 'pull_ups');
    expect(pull?.met).toBe(true);
    expect(pull?.gap).toBe(0);
  });

  it('reports an untested event as untested, not as a zero result', () => {
    const step = stepFor([result('pull_ups', 21)], 'swimming');
    const swim = step?.events.find((e) => e.eventId === 'swim_500m');
    expect(swim?.current).toBeNull();
    expect(swim?.gap).toBeNull();
    expect(swim?.met).toBe(false);
  });
});

describe('nothing left to do', () => {
  const STRONG: readonly AssessmentResult[] = [
    result('pull_ups', 25),
    result('push_ups', 90),
    result('sit_ups', 95),
    result('run_1_5_mile', 520),
    result('run_1_mile', 350),
    result('ruck_3_mile', 2300),
    result('swim_500m', 520),
  ];

  it('marks domains at the benchmark as maintain, with no impact', () => {
    const road = buildRoadToReady(
      PARARESCUE,
      calculatePipelineReadiness(PARARESCUE, { results: STRONG }),
      STRONG,
    );
    const maintained = road.steps.filter((step) => step.kind === 'maintain');
    expect(maintained.length).toBeGreaterThan(0);
    expect(road.atBenchmark).toBe(maintained.length);
    for (const step of maintained) {
      expect(step.impact).toBe(0);
    }
  });

  it('never reports negative impact for someone past the benchmark', () => {
    const road = buildRoadToReady(
      PARARESCUE,
      calculatePipelineReadiness(PARARESCUE, { results: STRONG }),
      STRONG,
    );
    for (const step of road.steps) {
      expect(step.impact).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('no readiness at all', () => {
  it('asks for a first assessment instead of failing', () => {
    const road = buildRoadToReady(PARARESCUE, null, []);
    expect(road.steps).toHaveLength(PARARESCUE.domains.length);
    expect(road.focus?.kind).toBe('measure');
    expect(road.atBenchmark).toBe(0);
  });
});
