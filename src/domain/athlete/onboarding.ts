import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import { validateHandle } from '@/domain/candidate/handle';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import type { Goal } from '@/domain/goals/types';
import { calculateReadiness } from '@/domain/readiness/score';
import type { ReadinessCalculation } from '@/domain/readiness/types';
import type { IsoDateTime, Uuid } from '@/domain/types';

import { recommendTrack, type TrackRecommendation } from './recommendTrack';
import type { BaselineEntries, OnboardingDraft } from './types';

/**
 * Turns an onboarding draft into the outcome the athlete is shown and the data
 * that gets persisted.
 *
 * This is one pure function on purpose. The result screen previews the outcome
 * before anything is saved, and the save path persists it afterwards; running
 * both through the same function is what stops the preview and the stored
 * record from ever disagreeing.
 */

/** Baseline entries as assessment results, ready for scoring or persistence. */
export function buildBaselineResults(
  baseline: BaselineEntries,
  athleteId: Uuid,
  recordedAt: IsoDateTime,
): AssessmentResult[] {
  return Object.entries(baseline).flatMap(([eventId, value]) => {
    if (value === undefined) {
      return [];
    }
    return [
      {
        // Ids are assigned by the repository on write. This placeholder only
        // ever exists inside a scoring calculation.
        id: `baseline-${eventId}`,
        athleteId,
        eventId: eventId as AssessmentEventId,
        value,
        recordedAt,
        notes: null,
      },
    ];
  });
}

export interface OnboardingOutcome {
  goal: Goal;
  /** Null when the athlete deferred every test. */
  calculation: ReadinessCalculation | null;
  recommendation: TrackRecommendation;
  /** How many of the baseline events were actually entered. */
  testedEventCount: number;
}

const PREVIEW_ATHLETE_ID = 'preview';
const PREVIEW_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export function computeOnboardingOutcome(draft: OnboardingDraft): OnboardingOutcome {
  const goal = getGoalOrDefault(draft.goalId);

  // The timestamp is irrelevant to scoring here: every baseline entry shares
  // one sitting, so there is no "latest result" contest to resolve.
  const results = buildBaselineResults(draft.baseline, PREVIEW_ATHLETE_ID, PREVIEW_TIMESTAMP);

  const calculation = calculateReadiness(goal, results);

  const recommendation = recommendTrack({
    readiness: calculation?.overall ?? null,
    runningExperience: draft.runningExperience ?? 'none',
    swimmingExperience: draft.swimmingExperience ?? 'none',
    ruckingExperience: draft.ruckingExperience ?? 'none',
  });

  return {
    goal,
    calculation,
    recommendation,
    testedEventCount: results.length,
  };
}

// --- Step validation ---------------------------------------------------------

export type OnboardingStep = 'goal' | 'identity' | 'experience' | 'timeline' | 'baseline';

/** The baseline step is always satisfiable: every test can be deferred. */
export function isStepComplete(draft: OnboardingDraft, step: OnboardingStep): boolean {
  switch (step) {
    case 'goal':
      return draft.goalId !== null;
    case 'identity':
      // A valid handle is the one hard requirement. State is optional and
      // visibility always holds a value.
      return validateHandle(draft.handleInput).ok;
    case 'experience':
      return (
        draft.runningExperience !== null &&
        draft.swimmingExperience !== null &&
        draft.ruckingExperience !== null &&
        draft.trainingDaysPerWeek !== null
      );
    case 'timeline':
      // Optional by design: most athletes early in the process have no date,
      // and inventing one to pass a gate would poison the countdown.
      return true;
    case 'baseline':
      return true;
  }
}
