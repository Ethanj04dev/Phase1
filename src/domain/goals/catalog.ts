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
    emphasis: { running: 0.25, swimming: 0.3, calisthenics: 0.2, rucking: 0.15, strength: 0.1 },
  },
  {
    id: 'combat_control',
    name: 'Combat Control',
    shortName: 'CCT PREP',
    branch: 'air_force',
    description: 'Balanced running, water and load-bearing demands.',
    emphasis: { running: 0.25, swimming: 0.25, calisthenics: 0.2, rucking: 0.2, strength: 0.1 },
  },
  {
    id: 'tacp',
    name: 'TACP',
    shortName: 'TACP PREP',
    branch: 'air_force',
    description: 'Running volume with a heavy ruck emphasis.',
    emphasis: { running: 0.3, swimming: 0.1, calisthenics: 0.2, rucking: 0.3, strength: 0.1 },
  },
  {
    id: 'special_reconnaissance',
    name: 'Special Reconnaissance',
    shortName: 'SR PREP',
    branch: 'air_force',
    description: 'Broad aerobic base across land and water.',
    emphasis: { running: 0.25, swimming: 0.25, calisthenics: 0.2, rucking: 0.2, strength: 0.1 },
  },
  {
    id: 'sere',
    name: 'SERE',
    shortName: 'SERE PREP',
    branch: 'air_force',
    description: 'Load carriage and durable aerobic endurance.',
    emphasis: { running: 0.25, swimming: 0.15, calisthenics: 0.2, rucking: 0.3, strength: 0.1 },
  },
  {
    id: 'navy_seal',
    name: 'Navy SEAL',
    shortName: 'SEAL PREP',
    branch: 'navy',
    description: 'Swim-dominant with high calisthenics standards.',
    emphasis: { running: 0.25, swimming: 0.3, calisthenics: 0.25, rucking: 0.1, strength: 0.1 },
  },
  {
    id: 'swcc',
    name: 'SWCC',
    shortName: 'SWCC PREP',
    branch: 'navy',
    description: 'Water work with upper-body strength emphasis.',
    emphasis: { running: 0.2, swimming: 0.3, calisthenics: 0.25, rucking: 0.1, strength: 0.15 },
  },
  {
    id: 'eod',
    name: 'EOD',
    shortName: 'EOD PREP',
    branch: 'navy',
    description: 'Even split across water, running and strength.',
    emphasis: { running: 0.25, swimming: 0.25, calisthenics: 0.2, rucking: 0.15, strength: 0.15 },
  },
  {
    id: 'army_ranger',
    name: 'Army Ranger',
    shortName: 'RANGER PREP',
    branch: 'army',
    description: 'Running speed and sustained ruck performance.',
    emphasis: { running: 0.3, swimming: 0.05, calisthenics: 0.25, rucking: 0.3, strength: 0.1 },
  },
  {
    id: 'army_special_forces',
    name: 'Army Special Forces',
    shortName: 'SF PREP',
    branch: 'army',
    description: 'Ruck-dominant with a deep aerobic base.',
    emphasis: { running: 0.25, swimming: 0.05, calisthenics: 0.2, rucking: 0.4, strength: 0.1 },
  },
  {
    id: 'marine_recon',
    name: 'Marine Recon',
    shortName: 'RECON PREP',
    branch: 'marine_corps',
    description: 'Water confidence with strong calisthenics.',
    emphasis: { running: 0.25, swimming: 0.25, calisthenics: 0.25, rucking: 0.15, strength: 0.1 },
  },
  {
    id: 'marsoc',
    name: 'MARSOC',
    shortName: 'MARSOC PREP',
    branch: 'marine_corps',
    description: 'Load carriage balanced with water and running.',
    emphasis: { running: 0.25, swimming: 0.2, calisthenics: 0.2, rucking: 0.25, strength: 0.1 },
  },
  {
    id: 'general_selection',
    name: 'General Selection Prep',
    shortName: 'SELECTION PREP',
    branch: 'general',
    description: 'Broad preparation if you have not chosen a pipeline yet.',
    emphasis: { running: 0.25, swimming: 0.15, calisthenics: 0.25, rucking: 0.2, strength: 0.15 },
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
