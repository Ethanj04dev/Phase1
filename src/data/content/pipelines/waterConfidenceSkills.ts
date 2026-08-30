import type { ProficiencySkill } from '@/domain/pipeline/types';

/**
 * The water confidence skill set, shared by every water career.
 *
 * Extracted the moment a second water Target existed, because the safety
 * notices in here are the most important prose in the product and must never
 * fork. Two copies of the blackout warning is one copy waiting to be edited
 * carelessly.
 *
 * The generalised water-safety tests run over every Target that includes a
 * water confidence domain, so a career cannot adopt these skills and drop
 * the supervision requirement on the way.
 */
export const WATER_CONFIDENCE_SKILLS: readonly ProficiencySkill[] = [
  {
    id: 'treading',
    label: 'Treading',
    description:
      'Staying comfortably afloat without using the hands, for progressively longer periods.',
    suggestedTarget: 'competent',
    requiresSupervision: false,
    safetyNotice: 'Never train in water alone, even for surface work.',
  },
  {
    id: 'fin_swimming',
    label: 'Fin swimming',
    description: 'Efficient surface and sub-surface movement wearing fins.',
    suggestedTarget: 'competent',
    requiresSupervision: false,
    safetyNotice: 'Never train in water alone, even for surface work.',
  },
  {
    id: 'mask_snorkel',
    label: 'Mask and snorkel',
    description: 'Clearing, breathing and moving comfortably with a mask and snorkel.',
    suggestedTarget: 'competent',
    requiresSupervision: false,
    safetyNotice: 'Never train in water alone, even for surface work.',
  },
  {
    id: 'equipment_comfort',
    label: 'Equipment familiarity',
    description:
      'Handling and adjusting equipment in the water without it raising your stress level.',
    suggestedTarget: 'developing',
    requiresSupervision: false,
    safetyNotice: 'Never train in water alone, even for surface work.',
  },
  {
    // The only skill here that can kill someone practising it wrongly.
    id: 'underwater_comfort',
    label: 'Underwater comfort',
    description:
      'Being calm and controlled below the surface during short, supervised skill work.',
    suggestedTarget: 'developing',
    requiresSupervision: true,
    safetyNotice:
      'Requires qualified in-water supervision. Never practise breath-holding or underwater work alone. Hyperventilating before going under, or pushing to your limit, can cause blackout without warning and drowning follows silently. Zero Phase does not measure or reward breath-hold performance.',
  },
];

/**
 * The water-safety article every water career's intel must carry, verbatim.
 * One wording, one place to review it.
 */
export const WATER_SAFETY_ARTICLE = {
  id: 'water_safety',
  category: 'preparation',
  title: 'Water and underwater work',
  body: [
    'Never train in water alone. That applies to easy surface swimming as much as to skill work.',
    'Any underwater or breath-holding practice requires qualified in-water supervision. Hyperventilating beforehand, or pushing to your limit, can cause blackout with no warning, and drowning follows silently.',
    'Zero Phase does not measure, rank or reward breath-hold performance, and never will. Water confidence here means being calm and capable, not proving how long you can stay under.',
  ],
} as const;
