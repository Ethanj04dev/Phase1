import type { ExperienceLevel } from '@/domain/types';

import type { TrainingTrackId } from './types';

/**
 * Chooses a starting training track.
 *
 * Deliberately simple and explainable: an athlete can be told exactly why they
 * landed where they did, and the thresholds can be retuned without touching a
 * screen. This is not adaptive programming, and it is not a judgement about
 * the athlete -- it only picks a sensible starting point, which they can change
 * later in their profile.
 */

const EXPERIENCE_RANK: Record<ExperienceLevel, number> = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/** Below this, the athlete needs a base before intensity. */
export const FOUNDATION_READINESS_CEILING = 45;
/** At or above this, the standard track will not be demanding enough. */
export const ADVANCED_READINESS_FLOOR = 75;

export interface TrackRecommendationInput {
  /** Overall readiness, or null when the athlete deferred every test. */
  readiness: number | null;
  runningExperience: ExperienceLevel;
  swimmingExperience: ExperienceLevel;
  ruckingExperience: ExperienceLevel;
}

export interface TrackRecommendation {
  trackId: TrainingTrackId;
  /** One sentence the UI can show verbatim. */
  rationale: string;
}

export function recommendTrack(input: TrackRecommendationInput): TrackRecommendation {
  const experiences = [
    input.runningExperience,
    input.swimmingExperience,
    input.ruckingExperience,
  ];

  const ranks = experiences.map((level) => EXPERIENCE_RANK[level]);
  const averageRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
  const hasUntrainedDiscipline = ranks.some((rank) => rank <= 1);

  // No baseline at all: experience is the only signal available.
  if (input.readiness === null) {
    if (averageRank < 1) {
      return {
        trackId: 'foundation',
        rationale: 'Based on your training background, you are starting from the base.',
      };
    }
    if (averageRank >= 2.5 && !hasUntrainedDiscipline) {
      return {
        trackId: 'advanced',
        rationale: 'Your training background suggests you are ready for higher volume.',
      };
    }
    return {
      trackId: 'selection_prep',
      rationale: 'Your training background puts you on the standard preparation track.',
    };
  }

  if (input.readiness < FOUNDATION_READINESS_CEILING) {
    return {
      trackId: 'foundation',
      rationale: 'Your baseline suggests building an aerobic base before adding intensity.',
    };
  }

  // A high overall score can hide a discipline the athlete has never trained.
  // Advanced volume in that discipline is where people get hurt, so the guard
  // holds them on the standard track until the gap closes.
  if (input.readiness >= ADVANCED_READINESS_FLOOR && !hasUntrainedDiscipline) {
    return {
      trackId: 'advanced',
      rationale: 'Your baseline is close to competitive standards across the board.',
    };
  }

  if (input.readiness >= ADVANCED_READINESS_FLOOR) {
    return {
      trackId: 'selection_prep',
      rationale:
        'Your baseline is strong, but one discipline is still new. Standard track first.',
    };
  }

  return {
    trackId: 'selection_prep',
    rationale: 'Your baseline puts you on the primary preparation track.',
  };
}
