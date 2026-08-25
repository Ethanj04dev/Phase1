import type { CategoryWeights } from '@/domain/types';

export type ServiceBranch = 'air_force' | 'navy' | 'army' | 'marine_corps' | 'general';

export const SERVICE_BRANCH_LABELS: Record<ServiceBranch, string> = {
  air_force: 'Air Force',
  navy: 'Navy',
  army: 'Army',
  marine_corps: 'Marine Corps',
  general: 'General',
};

export type GoalId =
  | 'pararescue'
  | 'combat_control'
  | 'tacp'
  | 'special_reconnaissance'
  | 'sere'
  | 'navy_seal'
  | 'swcc'
  | 'eod'
  | 'army_ranger'
  | 'army_special_forces'
  | 'marine_recon'
  | 'marsoc'
  | 'general_selection';

/**
 * A goal describes what the athlete is preparing for and, critically, how the
 * five performance categories should be weighted for them. Two athletes with
 * identical assessment results get different readiness scores because their
 * goals emphasise different things.
 */
export interface Goal {
  id: GoalId;
  name: string;
  /** Compact form for dense headers, e.g. "PJ PREP". */
  shortName: string;
  branch: ServiceBranch;
  /** One line, factual, no recruiting language. */
  description: string;
  emphasis: CategoryWeights;
}
