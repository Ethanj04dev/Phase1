/**
 * Legal and safety copy. Kept in one place so it can be reviewed as a unit
 * and reused across onboarding, profile and settings without drifting.
 */
export const disclaimers = {
  affiliation:
    'Phase 1 is an independent training product. It is not affiliated with, endorsed by, or associated with the U.S. Department of Defense, any branch of the U.S. Armed Forces, or any specific selection or training program.',

  readiness:
    'Your readiness score measures your current performance against Phase 1 training benchmarks only. It is not a prediction, and it does not guarantee selection, qualification, enlistment, or success in any military pipeline.',

  training:
    'Physical training carries a risk of injury. Train within your ability, progress gradually, and consult a qualified medical professional before starting a new training program.',

  medical: 'Phase 1 does not provide medical advice, diagnosis, or treatment.',

  water:
    'Never train in water alone, including easy surface swimming. Anything below the surface needs qualified in-water supervision.',
} as const;

/** Condensed line for footers and dense screens. */
export const shortDisclaimer =
  'Independent product. Not affiliated with the U.S. military. Readiness measures Phase 1 benchmarks only — it is not a prediction of selection.';
