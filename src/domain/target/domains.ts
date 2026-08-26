/**
 * The preparation domains Phase 1 can measure.
 *
 * This is a registry of what the product *knows how to talk about*, not a list
 * of what any athlete is scored on. A Target selects a subset and weights it,
 * so a Ranger candidate is never scored on swimming and a PJ candidate is
 * never told their rucking is the priority when their swim is the thing
 * standing between them and selection.
 */

export const PREPARATION_DOMAINS = [
  'running',
  'swimming',
  'water_confidence',
  'calisthenics',
  'strength',
  'rucking',
  'durability',
  'training_consistency',
] as const;

export type PreparationDomainId = (typeof PREPARATION_DOMAINS)[number];

/** How hard a Target leans on a domain. Ordered, so it can be compared. */
export const DEMAND_LEVELS = ['low', 'moderate', 'high', 'very_high'] as const;
export type DemandLevel = (typeof DEMAND_LEVELS)[number];

export const DEMAND_LEVEL_LABELS: Record<DemandLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very High',
};

export function demandRank(level: DemandLevel): number {
  return DEMAND_LEVELS.indexOf(level);
}

/**
 * How a domain is measured.
 *
 * `performance` domains have timed or counted assessments and score
 * continuously. `proficiency` domains are judged on an ordinal scale, because
 * "can you tread water for ten minutes in uniform" is not a number and
 * pretending otherwise would produce a fake precision. `behavioural` domains
 * are derived from what the athlete actually did rather than from a test.
 */
export type DomainMeasurement = 'performance' | 'proficiency' | 'behavioural';

export interface PreparationDomain {
  id: PreparationDomainId;
  label: string;
  /** Compact form for dense rows, e.g. "WATER". */
  shortLabel: string;
  measurement: DomainMeasurement;
  /** One line the UI can show to explain what this domain covers. */
  description: string;
}

export const PREPARATION_DOMAIN_REGISTRY: Record<
  PreparationDomainId,
  PreparationDomain
> = {
  running: {
    id: 'running',
    label: 'Running',
    shortLabel: 'RUN',
    measurement: 'performance',
    description: 'Sustained aerobic speed over distance, on foot and unloaded.',
  },
  swimming: {
    id: 'swimming',
    label: 'Swimming',
    shortLabel: 'SWIM',
    measurement: 'performance',
    description: 'Swimming speed and endurance over a measured distance.',
  },
  water_confidence: {
    id: 'water_confidence',
    label: 'Water Confidence',
    shortLabel: 'WATER',
    // Not a stopwatch domain. Comfort and competence in the water are
    // demonstrated, not timed, and forcing them into seconds would invent a
    // precision that does not exist.
    measurement: 'proficiency',
    description:
      'Comfort and competence in the water: treading, fin work, equipment familiarity and supervised skill work.',
  },
  calisthenics: {
    id: 'calisthenics',
    label: 'Calisthenics',
    shortLabel: 'CAL',
    measurement: 'performance',
    description: 'Body-weight strength endurance: pulling, pushing and trunk work.',
  },
  strength: {
    id: 'strength',
    label: 'Strength',
    shortLabel: 'STR',
    // Measured through safe, repeatable proxies -- loaded carries, weighted or
    // high-repetition body-weight work -- never a maximal lift. Asking an
    // untrained candidate for a one-rep max to populate a score is not a
    // trade this product makes.
    measurement: 'performance',
    description:
      'Usable strength for carrying, climbing and moving load, measured through safe submaximal work.',
  },
  rucking: {
    id: 'rucking',
    label: 'Rucking',
    shortLabel: 'RUCK',
    measurement: 'performance',
    description: 'Moving efficiently over ground under load.',
  },
  durability: {
    id: 'durability',
    label: 'Durability',
    shortLabel: 'DUR',
    measurement: 'behavioural',
    description:
      'Tolerance for repeated hard days without breaking down, built from training history rather than a test.',
  },
  training_consistency: {
    id: 'training_consistency',
    label: 'Training Consistency',
    shortLabel: 'CONS',
    measurement: 'behavioural',
    description: 'Whether the work is actually being done, week after week.',
  },
};

export function preparationDomain(id: PreparationDomainId): PreparationDomain {
  return PREPARATION_DOMAIN_REGISTRY[id];
}

/**
 * The ordinal scale for proficiency domains.
 *
 * Deliberately coarse. A finer scale would imply a precision that a
 * self-reported skill assessment does not have.
 */
export const PROFICIENCY_LEVELS = [
  'not_started',
  'developing',
  'competent',
  'strong',
] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const PROFICIENCY_LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  not_started: 'Not started',
  developing: 'Developing',
  competent: 'Competent',
  strong: 'Strong',
};

/** Score contribution of each proficiency level, 0-100. */
export const PROFICIENCY_LEVEL_SCORES: Record<ProficiencyLevel, number> = {
  not_started: 0,
  developing: 40,
  competent: 75,
  strong: 100,
};

export function proficiencyRank(level: ProficiencyLevel): number {
  return PROFICIENCY_LEVELS.indexOf(level);
}
