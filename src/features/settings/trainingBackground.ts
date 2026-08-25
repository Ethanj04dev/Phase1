import type { ExperienceField } from '@/features/onboarding/OnboardingProvider';
import type { ExperienceLevel } from '@/domain/types';

/**
 * The training background questions, shared by onboarding and settings so the
 * two cannot drift into asking different things.
 */

export interface DisciplineConfig {
  field: ExperienceField;
  label: string;
  levels: readonly ExperienceLevel[];
}

/**
 * Running omits "none" deliberately: everyone can run to some degree, whereas
 * an athlete may genuinely never have swum or carried a ruck.
 */
export const DISCIPLINES: readonly DisciplineConfig[] = [
  {
    field: 'runningExperience',
    label: 'Running',
    levels: ['beginner', 'intermediate', 'advanced'],
  },
  {
    field: 'swimmingExperience',
    label: 'Swimming',
    levels: ['none', 'beginner', 'intermediate', 'advanced'],
  },
  {
    field: 'ruckingExperience',
    label: 'Rucking',
    levels: ['none', 'beginner', 'intermediate', 'advanced'],
  },
];

export const TRAINING_DAY_OPTIONS = [3, 4, 5, 6] as const;
