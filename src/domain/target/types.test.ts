import { unverified, verified } from './provenance';
import {
  domainWeightsSumToOne,
  findDomain,
  officialStandardFor,
  phase1BenchmarkFor,
  type OfficialStandard,
  type Phase1Benchmark,
  type TargetDefinition,
} from './types';

function target(overrides: Partial<TargetDefinition> = {}): TargetDefinition {
  return {
    id: 'test_target',
    name: 'Test Target',
    shortName: 'TEST',
    branch: 'air_force',
    category: 'Test Category',
    description: 'A target used only in tests.',
    domains: [
      {
        id: 'running',
        weight: 0.6,
        demand: 'high',
        rationale: 'Because the tests say so.',
        eventIds: ['run_1_5_mile'],
      },
      {
        id: 'swimming',
        weight: 0.4,
        demand: 'very_high',
        rationale: 'Because the tests say so.',
        eventIds: ['swim_500m'],
      },
    ],
    officialStandards: [],
    phase1Benchmarks: [],
    assessments: [],
    pipeline: [],
    milestones: [],
    intel: [],
    sources: [],
    ...overrides,
  };
}

describe('domain weights', () => {
  it('accepts a full distribution', () => {
    expect(domainWeightsSumToOne(target())).toBe(true);
  });

  // The invariant readiness depends on. Weights that do not sum to one give
  // that Target's athletes a systematically skewed score.
  it('rejects weights that do not sum to one', () => {
    const skewed = target({
      domains: [
        {
          id: 'running',
          weight: 0.6,
          demand: 'high',
          rationale: 'x',
          eventIds: [],
        },
      ],
    });
    expect(domainWeightsSumToOne(skewed)).toBe(false);
  });

  it('tolerates floating point drift', () => {
    const drifting = target({
      domains: [
        { id: 'running', weight: 0.1, demand: 'low', rationale: 'x', eventIds: [] },
        { id: 'swimming', weight: 0.2, demand: 'low', rationale: 'x', eventIds: [] },
        { id: 'rucking', weight: 0.3, demand: 'low', rationale: 'x', eventIds: [] },
        {
          id: 'calisthenics',
          weight: 0.4,
          demand: 'low',
          rationale: 'x',
          eventIds: [],
        },
      ],
    });
    expect(domainWeightsSumToOne(drifting)).toBe(true);
  });
});

describe('domain lookup', () => {
  it('finds a domain the target scores', () => {
    expect(findDomain(target(), 'running')?.weight).toBe(0.6);
  });

  // A Target that does not score a domain must return nothing, not a zero.
  // Absent and zero mean different things: one is "not measured here", the
  // other is "measured and failed".
  it('returns nothing for a domain the target does not score', () => {
    expect(findDomain(target(), 'rucking')).toBeUndefined();
  });

  it('allows a domain with no assessment events', () => {
    const withUnmeasuredDomain = target({
      domains: [
        { id: 'running', weight: 0.5, demand: 'high', rationale: 'x', eventIds: [] },
        {
          id: 'water_confidence',
          weight: 0.5,
          demand: 'very_high',
          rationale: 'x',
          eventIds: [],
        },
      ],
    });
    expect(findDomain(withUnmeasuredDomain, 'water_confidence')?.eventIds).toHaveLength(
      0,
    );
    expect(domainWeightsSumToOne(withUnmeasuredDomain)).toBe(true);
  });
});

describe('official standards and Zero Phase benchmarks stay apart', () => {
  const standard: OfficialStandard = {
    eventId: 'run_1_5_mile',
    requirement: unverified('not yet sourced'),
  };
  const benchmark: Phase1Benchmark = {
    eventId: 'run_1_5_mile',
    target: 570,
    rationale: 'Where Zero Phase thinks an athlete should be to arrive prepared.',
  };
  const populated = target({
    officialStandards: [standard],
    phase1Benchmarks: [benchmark],
  });

  it('reads each from its own field', () => {
    expect(officialStandardFor(populated, 'run_1_5_mile')).toBe(standard);
    expect(phase1BenchmarkFor(populated, 'run_1_5_mile')).toBe(benchmark);
  });

  // The two carry different field names, so neither can be rendered through
  // the other's code path even by mistake.
  it('uses different value fields so neither can stand in for the other', () => {
    expect('target' in benchmark).toBe(true);
    expect('requirement' in standard).toBe(true);
    expect('target' in standard).toBe(false);
    expect('requirement' in benchmark).toBe(false);
  });

  // The failure this whole design exists to prevent.
  it('exposes no number for an unsourced official standard', () => {
    const found = officialStandardFor(populated, 'run_1_5_mile');
    expect(found?.requirement.status).toBe('unverified');
    if (found?.requirement.status === 'unverified') {
      expect(Object.prototype.hasOwnProperty.call(found.requirement, 'value')).toBe(
        false,
      );
    }
  });

  it('exposes the number once a standard is sourced', () => {
    const sourced = target({
      officialStandards: [
        {
          eventId: 'run_1_5_mile',
          requirement: verified({ value: 615, qualifier: 'minimum' }, 'src-1'),
        },
      ],
    });
    const found = officialStandardFor(sourced, 'run_1_5_mile');
    expect(found?.requirement.status).toBe('verified');
  });

  it('requires every Zero Phase benchmark to explain itself', () => {
    expect(benchmark.rationale.length).toBeGreaterThan(10);
  });

  it('returns nothing for an event the target does not cover', () => {
    expect(officialStandardFor(populated, 'pull_ups')).toBeUndefined();
    expect(phase1BenchmarkFor(populated, 'pull_ups')).toBeUndefined();
  });
});
