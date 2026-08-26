import {
  eventsForCategory,
  type AssessmentEventId,
  type AssessmentResult,
} from '@/domain/assessment/types';
import { GOALS, getGoalOrDefault } from '@/domain/goals/catalog';
import type { Goal } from '@/domain/goals/types';
import type { PreparationDomainId } from '@/domain/target/domains';
import type { TargetDefinition, TargetDomain } from '@/domain/target/types';
import { PERFORMANCE_CATEGORIES } from '@/domain/types';

import { calculateReadiness } from './score';
import { calculateTargetReadiness, scoreDomain } from './targetScore';

let counter = 0;
function result(
  eventId: AssessmentEventId,
  value: number,
  recordedAt = '2026-08-01T00:00:00.000Z',
): AssessmentResult {
  counter += 1;
  return { id: `r${counter}`, athleteId: 'a', eventId, value, recordedAt, notes: null };
}

/**
 * Builds the Target equivalent of an existing Goal: the same four domains,
 * the same weights, the same events per domain.
 */
function targetFromGoal(goal: Goal): TargetDefinition {
  const domains: TargetDomain[] = PERFORMANCE_CATEGORIES.map((category) => ({
    id: category as PreparationDomainId,
    weight: goal.emphasis[category],
    demand: 'high',
    rationale: 'Equivalence fixture.',
    eventIds: eventsForCategory(category).map((event) => event.id),
  }));

  return {
    id: goal.id,
    name: goal.name,
    shortName: goal.shortName,
    branch: goal.branch,
    category: 'Equivalence fixture',
    description: goal.description,
    domains,
    officialStandards: [],
    phase1Benchmarks: [],
    assessments: [],
    pipeline: [],
    milestones: [],
    intel: [],
    sources: [],
  };
}

const FULL_BATTERY = [
  result('pull_ups', 13),
  result('push_ups', 52),
  result('sit_ups', 61),
  result('run_1_mile', 424),
  result('run_1_5_mile', 648),
  result('swim_500m', 638),
  result('ruck_3_mile', 2880),
];

/**
 * The bar for this step: generalising the engine must not change a single
 * existing athlete's score. If any of these diverge, the new engine is a
 * rewrite wearing a refactor's clothes.
 */
describe('equivalence with the category engine', () => {
  it.each(GOALS.map((goal) => [goal.id, goal] as const))(
    'produces an identical overall score for %s',
    (_id, goal) => {
      const before = calculateReadiness(goal, FULL_BATTERY);
      const after = calculateTargetReadiness(targetFromGoal(goal), {
        results: FULL_BATTERY,
      });
      expect(after?.overall).toBe(before?.overall);
    },
  );

  it.each(GOALS.map((goal) => [goal.id, goal] as const))(
    'produces identical per-domain scores for %s',
    (_id, goal) => {
      const before = calculateReadiness(goal, FULL_BATTERY);
      const after = calculateTargetReadiness(targetFromGoal(goal), {
        results: FULL_BATTERY,
      });
      expect(after?.domains).toEqual(before?.categories);
    },
  );

  it('agrees on strongest and priority', () => {
    const goal = getGoalOrDefault('pararescue');
    const before = calculateReadiness(goal, FULL_BATTERY);
    const after = calculateTargetReadiness(targetFromGoal(goal), {
      results: FULL_BATTERY,
    });
    expect(after?.strongestDomain).toBe(before?.strongestCategory);
    expect(after?.priorityDomain).toBe(before?.priorityCategory);
  });

  it('agrees on coverage when only part of the battery is tested', () => {
    const goal = getGoalOrDefault('navy_seal');
    const partial = [result('pull_ups', 13), result('swim_500m', 638)];
    const before = calculateReadiness(goal, partial);
    const after = calculateTargetReadiness(targetFromGoal(goal), { results: partial });
    expect(after?.coverage).toBeCloseTo(before?.coverage ?? -1, 6);
    expect(after?.overall).toBe(before?.overall);
  });

  it('agrees that nothing tested means no score', () => {
    const goal = getGoalOrDefault('pararescue');
    expect(calculateTargetReadiness(targetFromGoal(goal), { results: [] })).toBeNull();
    expect(calculateReadiness(goal, [])).toBeNull();
  });
});

// --- What the new engine can do that the old one could not ------------------

function domain(overrides: Partial<TargetDomain> & { id: PreparationDomainId }): TargetDomain {
  return {
    weight: 1,
    demand: 'high',
    rationale: 'x',
    eventIds: [],
    ...overrides,
  };
}

function targetWith(domains: TargetDomain[]): TargetDefinition {
  return {
    id: 't',
    name: 'T',
    shortName: 'T',
    branch: 'air_force',
    category: 'c',
    description: 'd',
    domains,
    officialStandards: [],
    phase1Benchmarks: [],
    assessments: [],
    pipeline: [],
    milestones: [],
    intel: [],
    sources: [],
  };
}

describe('Target-specific domains', () => {
  // The whole point of the refactor: two Targets, same performances,
  // different domains scored.
  it('scores only the domains the Target defines', () => {
    const runnerOnly = targetWith([
      domain({ id: 'running', eventIds: ['run_1_5_mile'] }),
    ]);
    const readiness = calculateTargetReadiness(runnerOnly, { results: FULL_BATTERY });
    expect(Object.keys(readiness?.domains ?? {})).toEqual(['running']);
    expect(readiness?.coverage).toBe(1);
  });

  it('never scores a domain the Target omits, however much data exists', () => {
    const noSwimming = targetWith([
      domain({ id: 'running', weight: 0.5, eventIds: ['run_1_5_mile'] }),
      domain({ id: 'rucking', weight: 0.5, eventIds: ['ruck_3_mile'] }),
    ]);
    const readiness = calculateTargetReadiness(noSwimming, { results: FULL_BATTERY });
    expect(readiness?.domains.swimming).toBeUndefined();
  });
});

describe('proficiency domains', () => {
  const water = domain({
    id: 'water_confidence',
    proficiencySkills: [
      {
        id: 'treading',
        label: 'Treading',
        description: 'x',
        phase1Target: 'competent',
        requiresSupervision: false,
      },
      {
        id: 'fin_swimming',
        label: 'Fin swimming',
        description: 'x',
        phase1Target: 'competent',
        requiresSupervision: false,
      },
    ],
  });

  it('averages the recorded skill levels', () => {
    // developing = 40, strong = 100
    expect(
      scoreDomain(water, {
        results: [],
        proficiency: { treading: 'developing', fin_swimming: 'strong' },
      }),
    ).toBe(70);
  });

  it('scores only the skills actually recorded', () => {
    expect(
      scoreDomain(water, { results: [], proficiency: { treading: 'competent' } }),
    ).toBe(75);
  });

  // Unmeasured is not failed.
  it('returns null when no skill has been assessed', () => {
    expect(scoreDomain(water, { results: [] })).toBeNull();
  });

  it('scores a skill explicitly marked not started as zero', () => {
    expect(
      scoreDomain(water, { results: [], proficiency: { treading: 'not_started' } }),
    ).toBe(0);
  });
});

describe('behavioural domains', () => {
  const consistency = domain({ id: 'training_consistency' });

  it('takes the score the caller supplies', () => {
    expect(
      scoreDomain(consistency, {
        results: [],
        behavioural: { training_consistency: 72 },
      }),
    ).toBe(72);
  });

  it('returns null when the caller has no history to offer', () => {
    expect(scoreDomain(consistency, { results: [] })).toBeNull();
  });

  it('clamps a supplied score into range', () => {
    expect(
      scoreDomain(consistency, { results: [], behavioural: { training_consistency: 140 } }),
    ).toBe(100);
    expect(
      scoreDomain(consistency, { results: [], behavioural: { training_consistency: -20 } }),
    ).toBe(0);
  });
});

describe('mixed measurement Target', () => {
  const pjLike = targetWith([
    domain({ id: 'running', weight: 0.3, eventIds: ['run_1_5_mile'] }),
    domain({
      id: 'water_confidence',
      weight: 0.4,
      proficiencySkills: [
        {
          id: 'treading',
          label: 'Treading',
          description: 'x',
          phase1Target: 'competent',
          requiresSupervision: false,
        },
      ],
    }),
    domain({ id: 'training_consistency', weight: 0.3 }),
  ]);

  it('combines performance, proficiency and behavioural domains', () => {
    const readiness = calculateTargetReadiness(pjLike, {
      results: [result('run_1_5_mile', 630)],
      proficiency: { treading: 'strong' },
      behavioural: { training_consistency: 50 },
    });
    expect(readiness?.coverage).toBeCloseTo(1, 6);
    expect(readiness?.domains.water_confidence).toBe(100);
    expect(readiness?.domains.training_consistency).toBe(50);
    expect(readiness?.strongestDomain).toBe('water_confidence');
  });

  it('renormalises when only some domains have data', () => {
    // Only water confidence, weighted 0.4 of the Target.
    const readiness = calculateTargetReadiness(pjLike, {
      results: [],
      proficiency: { treading: 'strong' },
    });
    expect(readiness?.coverage).toBeCloseTo(0.4, 6);
    expect(readiness?.overall).toBe(100);
  });

  it('picks priority by weighted headroom rather than raw weakness', () => {
    const readiness = calculateTargetReadiness(pjLike, {
      results: [],
      // water: 40 at weight .4 -> headroom 24
      proficiency: { treading: 'developing' },
      // consistency: 30 at weight .3 -> headroom 21
      behavioural: { training_consistency: 30 },
    });
    expect(readiness?.domains.training_consistency).toBeLessThan(
      readiness?.domains.water_confidence ?? 0,
    );
    expect(readiness?.priorityDomain).toBe('water_confidence');
  });

  it('is deterministic', () => {
    const input = {
      results: [result('run_1_5_mile', 630)],
      proficiency: { treading: 'competent' as const },
      behavioural: { training_consistency: 60 },
    };
    expect(calculateTargetReadiness(pjLike, input)).toEqual(
      calculateTargetReadiness(pjLike, input),
    );
  });
});
