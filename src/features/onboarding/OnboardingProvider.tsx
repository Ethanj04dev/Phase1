import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { NewAssessmentResult } from '@/data/repositories/types';
import type { AssessmentEventId } from '@/domain/assessment/types';
import {
  computeOnboardingOutcome,
  isStepComplete,
  type OnboardingOutcome,
  type OnboardingStep,
} from '@/domain/athlete/onboarding';
import { EMPTY_ONBOARDING_DRAFT, type OnboardingDraft } from '@/domain/athlete/types';
import type { ExperienceLevel } from '@/domain/types';
import type { GoalId } from '@/domain/goals/types';
import { recordReadinessSnapshot } from '@/features/readiness/recordSnapshot';

export type ExperienceField = 'runningExperience' | 'swimmingExperience' | 'ruckingExperience';

interface OnboardingContextValue {
  draft: OnboardingDraft;
  /** Live preview of the readiness and track the draft would produce. */
  outcome: OnboardingOutcome;
  setGoal: (goalId: GoalId) => void;
  setExperience: (field: ExperienceField, level: ExperienceLevel) => void;
  setTrainingDays: (days: number) => void;
  /** Passing null clears the entry, which is how TEST LATER works. */
  setBaselineValue: (eventId: AssessmentEventId, value: number | null) => void;
  canAdvance: (step: OnboardingStep) => boolean;
  submit: () => Promise<boolean>;
  submitting: boolean;
  submitError: string | null;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/**
 * Owns the onboarding draft.
 *
 * The draft is intentionally in memory only. Onboarding takes about two
 * minutes, and persisting a half-finished draft would mean writing migration
 * logic for a shape that exists for two minutes and then never again. Nothing
 * is written until the athlete confirms on the final screen.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { athlete, assessment, proficiency, readiness, training } = useRepositories();
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_ONBOARDING_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const outcome = useMemo(() => computeOnboardingOutcome(draft), [draft]);

  const setGoal = useCallback((goalId: GoalId) => {
    setDraft((current) => ({ ...current, goalId }));
  }, []);

  const setExperience = useCallback((field: ExperienceField, level: ExperienceLevel) => {
    setDraft((current) => ({ ...current, [field]: level }));
  }, []);

  const setTrainingDays = useCallback((trainingDaysPerWeek: number) => {
    setDraft((current) => ({ ...current, trainingDaysPerWeek }));
  }, []);

  const setBaselineValue = useCallback((eventId: AssessmentEventId, value: number | null) => {
    setDraft((current) => {
      const baseline = { ...current.baseline };
      if (value === null) {
        delete baseline[eventId];
      } else {
        baseline[eventId] = value;
      }
      return { ...current, baseline };
    });
  }, []);

  const canAdvance = useCallback(
    (step: OnboardingStep) => isStepComplete(draft, step),
    [draft],
  );

  /**
   * Persists the draft.
   *
   * Local storage has no transactions, so the profile is created with
   * `onboardingCompleted: false` and only flipped true once the results and
   * the first readiness snapshot are safely written. A failure part-way
   * through therefore leaves the athlete in onboarding to retry, rather than
   * dropping them onto an empty dashboard that claims they are set up.
   */
  const submit = useCallback(async (): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // The preview calculation is not reused here. The first stored snapshot
      // is computed after the results are written, from the repository, so it
      // is scored the same way every later snapshot will be.
      const { goal, recommendation } = computeOnboardingOutcome(draft);

      const created = await athlete.createProfile({
        displayName: 'Athlete',
        goalId: goal.id,
        trackId: recommendation.trackId,
        runningExperience: draft.runningExperience ?? 'none',
        swimmingExperience: draft.swimmingExperience ?? 'none',
        ruckingExperience: draft.ruckingExperience ?? 'none',
        trainingDaysPerWeek: draft.trainingDaysPerWeek ?? 3,
        onboardingCompleted: false,
      });

      if (!created.ok) {
        setSubmitError(created.error.message);
        return false;
      }
      const profile = created.value;

      const entries: NewAssessmentResult[] = Object.entries(draft.baseline).flatMap(
        ([eventId, value]) =>
          value === undefined ? [] : [{ eventId: eventId as AssessmentEventId, value }],
      );

      if (entries.length > 0) {
        const recorded = await assessment.recordResults(profile.id, entries);
        if (!recorded.ok) {
          setSubmitError(recorded.error.message);
          return false;
        }
      }

      // Recorded after the baseline results are written, so the first
      // snapshot scores the athlete as they actually are rather than as they
      // were a moment before they told us anything.
      const snapshot = await recordReadinessSnapshot(
        { assessment, proficiency, readiness, training },
        profile,
      );
      if (!snapshot.ok) {
        setSubmitError(snapshot.error.message);
        return false;
      }

      const finalised = await athlete.updateProfile(profile.id, {
        onboardingCompleted: true,
      });
      if (!finalised.ok) {
        setSubmitError(finalised.error.message);
        return false;
      }

      return true;
    } finally {
      setSubmitting(false);
    }
  }, [assessment, athlete, draft, proficiency, readiness, training]);

  const value = useMemo(
    () => ({
      draft,
      outcome,
      setGoal,
      setExperience,
      setTrainingDays,
      setBaselineValue,
      canAdvance,
      submit,
      submitting,
      submitError,
    }),
    [
      canAdvance,
      draft,
      outcome,
      setBaselineValue,
      setExperience,
      setGoal,
      setTrainingDays,
      submit,
      submitError,
      submitting,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used inside an OnboardingProvider');
  }
  return context;
}
