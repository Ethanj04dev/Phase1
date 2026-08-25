import type { CategoryWeights, PerformanceCategory } from '@/domain/types';
import { PERFORMANCE_CATEGORIES } from '@/domain/types';

import type { Goal, GoalId } from './types';

/**
 * Emphasis weights are an editorial judgement about what each pipeline demands
 * physically. They are public, adjustable numbers. They are not a claim about
 * official standards and are not derived from any proprietary program.
 */
export const GOALS: readonly Goal[] = [
  {
    id: 'pararescue',
    name: 'Pararescue',
    shortName: 'PJ PREP',
    branch: 'air_force',
    description: 'Water confidence and sustained aerobic work under load.',
    emphasis: { running: 0.28, swimming: 0.33, calisthenics: 0.22, rucking: 0.17 },
  },
  {
    id: 'combat_control',
    name: 'Combat Control',
    shortName: 'CCT PREP',
    branch: 'air_force',
    description: 'Balanced running, water and load-bearing demands.',
    emphasis: { running: 0.28, swimming: 0.28, calisthenics: 0.22, rucking: 0.22 },
  },
  {
    id: 'tacp',
    name: 'TACP',
    shortName: 'TACP PREP',
    branch: 'air_force',
    description: 'Running volume with a heavy ruck emphasis.',
    emphasis: { running: 0.33, swimming: 0.11, calisthenics: 0.23, rucking: 0.33 },
  },
  {
    id: 'special_reconnaissance',
    name: 'Special Reconnaissance',
    shortName: 'SR PREP',
    branch: 'air_force',
    description: 'Broad aerobic base across land and water.',
    emphasis: { running: 0.28, swimming: 0.28, calisthenics: 0.22, rucking: 0.22 },
  },
  {
    id: 'sere',
    name: 'SERE',
    shortName: 'SERE PREP',
    branch: 'air_force',
    description: 'Load carriage and durable aerobic endurance.',
    emphasis: { running: 0.28, swimming: 0.17, calisthenics: 0.22, rucking: 0.33 },
  },
  {
    id: 'navy_seal',
    name: 'Navy SEAL',
    shortName: 'SEAL PREP',
    branch: 'navy',
    description: 'Swim-dominant with high calisthenics standards.',
    emphasis: { running: 0.28, swimming: 0.33, calisthenics: 0.28, rucking: 0.11 },
  },
  {
    id: 'swcc',
    name: 'SWCC',
    shortName: 'SWCC PREP',
    branch: 'navy',
    description: 'Water work with heavy upper-body demand.',
    emphasis: { running: 0.24, swimming: 0.35, calisthenics: 0.29, rucking: 0.12 },
  },
  {
    id: 'eod',
    name: 'EOD',
    shortName: 'EOD PREP',
    branch: 'navy',
    description: 'Even split across water, running and load carriage.',
    emphasis: { running: 0.29, swimming: 0.29, calisthenics: 0.24, rucking: 0.18 },
  },
  {
    id: 'army_ranger',
    name: 'Army Ranger',
    shortName: 'RANGER PREP',
    branch: 'army',
    description: 'Running speed and sustained ruck performance.',
    emphasis: { running: 0.33, swimming: 0.06, calisthenics: 0.28, rucking: 0.33 },
  },
  {
    id: 'army_special_forces',
    name: 'Army Special Forces',
    shortName: 'SF PREP',
    branch: 'army',
    description: 'Ruck-dominant with a deep aerobic base.',
    emphasis: { running: 0.28, swimming: 0.06, calisthenics: 0.22, rucking: 0.44 },
  },
  {
    id: 'marine_recon',
    name: 'Marine Recon',
    shortName: 'RECON PREP',
    branch: 'marine_corps',
    description: 'Water confidence with strong calisthenics.',
    emphasis: { running: 0.28, swimming: 0.28, calisthenics: 0.28, rucking: 0.16 },
  },
  {
    id: 'marsoc',
    name: 'MARSOC',
    shortName: 'MARSOC PREP',
    branch: 'marine_corps',
    description: 'Load carriage balanced with water and running.',
    emphasis: { running: 0.28, swimming: 0.22, calisthenics: 0.22, rucking: 0.28 },
  },
  {
    id: 'general_selection',
    name: 'General Selection Prep',
    shortName: 'SELECTION PREP',
    branch: 'general',
    description: 'Broad preparation if you have not chosen a pipeline yet.',
    emphasis: { running: 0.29, swimming: 0.18, calisthenics: 0.29, rucking: 0.24 },
  },
] as const;

const GOALS_BY_ID = new Map<GoalId, Goal>(GOALS.map((goal) => [goal.id, goal]));

export function findGoal(id: GoalId): Goal | undefined {
  return GOALS_BY_ID.get(id);
}

/** Falls back to general preparation rather than throwing on an unknown id. */
export function getGoalOrDefault(id: GoalId | null | undefined): Goal {
  const fallback = GOALS_BY_ID.get('general_selection');
  if (!fallback) {
    throw new Error('Goal catalog is missing the general_selection fallback');
  }
  return (id ? GOALS_BY_ID.get(id) : undefined) ?? fallback;
}

/** Guards the invariant that emphasis weights describe a full distribution. */
export function weightsSumToOne(weights: CategoryWeights, tolerance = 1e-6): boolean {
  const total = PERFORMANCE_CATEGORIES.reduce(
    (sum: number, category: PerformanceCategory) => sum + weights[category],
    0,
  );
  return Math.abs(total - 1) <= tolerance;
}
