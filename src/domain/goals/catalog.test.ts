import { PERFORMANCE_CATEGORIES } from '@/domain/types';

import { GOALS, findGoal, getGoalOrDefault, weightsSumToOne } from './catalog';

describe('goal catalog', () => {
  it('has a unique id for every goal', () => {
    const ids = GOALS.map((goal) => goal.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // This is the invariant the readiness score depends on: if a goal emphasis
  // does not sum to 1, that athlete gets a systematically skewed score.
  it.each(GOALS.map((goal) => [goal.id, goal] as const))(
    'weights for %s sum to 1',
    (_id, goal) => {
      expect(weightsSumToOne(goal.emphasis)).toBe(true);
    },
  );

  it.each(GOALS.map((goal) => [goal.id, goal] as const))(
    'weights for %s cover every category with a non-negative value',
    (_id, goal) => {
      for (const category of PERFORMANCE_CATEGORIES) {
        expect(goal.emphasis[category]).toBeGreaterThanOrEqual(0);
      }
    },
  );
});

describe('findGoal', () => {
  it('returns the requested goal', () => {
    expect(findGoal('pararescue')?.name).toBe('Pararescue');
  });
});

describe('getGoalOrDefault', () => {
  it('returns the requested goal when it exists', () => {
    expect(getGoalOrDefault('navy_seal').id).toBe('navy_seal');
  });

  it('falls back to general preparation for a missing goal', () => {
    expect(getGoalOrDefault(null).id).toBe('general_selection');
    expect(getGoalOrDefault(undefined).id).toBe('general_selection');
  });
});

describe('weightsSumToOne', () => {
  it('rejects a distribution that does not sum to 1', () => {
    expect(
      weightsSumToOne({
        running: 0.5,
        swimming: 0.5,
        calisthenics: 0.5,
        rucking: 0,
      }),
    ).toBe(false);
  });

  it('tolerates floating point drift', () => {
    expect(
      weightsSumToOne({
        running: 0.1,
        swimming: 0.2,
        calisthenics: 0.3,
        rucking: 0.4,
      }),
    ).toBe(true);
  });
});
