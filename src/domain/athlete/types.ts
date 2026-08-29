import type { AssessmentEventId } from '@/domain/assessment/types';
import type { GoalId } from '@/domain/goals/types';
import type { ExperienceLevel, IsoDate, IsoDateTime, Uuid } from '@/domain/types';

/**
 * Training tracks are the three programs the MVP ships. Keeping this a small
 * closed union (rather than one program per pipeline) is what stops the
 * content problem from exploding before the product is proven.
 */
export type TrainingTrackId = 'foundation' | 'selection_prep' | 'advanced';

export interface TrainingTrack {
  id: TrainingTrackId;
  name: string;
  /** Compact label for headers. */
  code: string;
  summary: string;
  focus: readonly string[];
}

export const TRAINING_TRACKS: readonly TrainingTrack[] = [
  {
    id: 'foundation',
    name: 'Foundation',
    code: 'FOUNDATION',
    summary: 'Build an aerobic base and basic strength before adding intensity.',
    focus: [
      'Aerobic development',
      'Basic calisthenics',
      'Beginner swimming',
      'Gradual, injury-aware progression',
    ],
  },
  {
    id: 'selection_prep',
    name: 'Selection Prep',
    code: 'SELECTION PREP',
    summary: 'The primary track. Balanced running, water, load and strength work.',
    focus: [
      'Running volume and intervals',
      'Swimming technique and endurance',
      'Rucking',
      'Calisthenics and strength',
      'Scheduled assessments',
    ],
  },
  {
    id: 'advanced',
    name: 'Advanced',
    code: 'ADVANCED',
    summary: 'For athletes already near competitive standards.',
    focus: [
      'Higher running volume',
      'Faster interval targets',
      'Demanding swim sets',
      'Increased ruck load and distance',
      'Harder assessment standards',
    ],
  },
] as const;

export function findTrack(id: TrainingTrackId): TrainingTrack | undefined {
  return TRAINING_TRACKS.find((track) => track.id === id);
}

/**
 * The athlete profile. Mirrors the `athlete_profiles` table one-to-one so the
 * mock repository and the eventual Supabase repository return the same shape.
 */
export interface AthleteProfile {
  id: Uuid;
  userId: Uuid;
  displayName: string;
  goalId: GoalId;
  trackId: TrainingTrackId;
  runningExperience: ExperienceLevel;
  swimmingExperience: ExperienceLevel;
  ruckingExperience: ExperienceLevel;
  trainingDaysPerWeek: number;
  /**
   * The athlete's own selection or ship date, if they have one. Optional and
   * self-reported, like a milestone: Phase 1 records it, cannot verify it,
   * and uses it only to anchor the countdown. Absent on records written
   * before the field existed.
   */
  selectionDate?: IsoDate | null;
  onboardingCompleted: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * Baseline performances entered during onboarding, keyed by event. Every entry
 * is optional: an athlete can defer any test and still finish onboarding.
 */
export type BaselineEntries = Partial<Record<AssessmentEventId, number>>;

/**
 * Everything onboarding collects, before a profile row exists.
 *
 * There is no `trackId` here. The track is derived from the athlete's baseline
 * and experience rather than asked as a sixth question, which removes a
 * decision the athlete is not yet equipped to make.
 */
export interface OnboardingDraft {
  goalId: GoalId | null;
  runningExperience: ExperienceLevel | null;
  swimmingExperience: ExperienceLevel | null;
  ruckingExperience: ExperienceLevel | null;
  trainingDaysPerWeek: number | null;
  /** Optional. Most athletes early in the process do not have one yet. */
  selectionDate: IsoDate | null;
  baseline: BaselineEntries;
}

export const EMPTY_ONBOARDING_DRAFT: OnboardingDraft = {
  goalId: null,
  runningExperience: null,
  swimmingExperience: null,
  ruckingExperience: null,
  trainingDaysPerWeek: null,
  selectionDate: null,
  baseline: {},
};
