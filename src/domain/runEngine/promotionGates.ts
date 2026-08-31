/**
 * Run Engine promotion gates, version 1.
 *
 * The measurable conditions under which the Run Engine may be promoted from
 * shadow to authoritative — proposed numbers, owner-approved before use,
 * versioned so a change is a decision with a diff. "Good enough" is never
 * subjective: every gate is a query over recorded data.
 *
 * False verification remains the primary safety metric. A higher
 * unable-to-verify rate is an acceptable price; a single measured false
 * verification above the gate is disqualifying.
 */

export const RUN_PROMOTION_GATES_VERSION = 1;

export const RUN_PROMOTION_GATES = {
  /** Synthetic benchmark (docs/benchmarks/run-engine-v2.md), every release. */
  benchmark: {
    /** Mean |distance error| across all conditions, percent. */
    maxMeanAbsDistanceErrorPct: 1.5,
    /** Worst single-condition |distance error|, percent. */
    maxWorstDistanceErrorPct: 4,
    /** Signed mean across conditions (athlete-favouring bias), percent. */
    maxSignedBiasPct: 0.5,
    /** Accepted-time mean/max |error| on verified runs, seconds. */
    maxMeanTimeErrorSeconds: 8,
    maxWorstTimeErrorSeconds: 25,
    /** Fraction of runs whose true error the uncertainty bound covers. */
    minUncertaintyCoverage: 0.9,
    falseVerifications: 0,
    falseFailures: 0,
  },

  /** Adversarial suite: every case passes, no regressions, every release. */
  adversarial: {
    requiredPassRate: 1.0,
  },

  /**
   * Real-device calibration corpus (Run Lab + fixtures), before promotion.
   * Reference distances come from measured courses (tracks, wheel-measured
   * routes).
   */
  realDevice: {
    minTraces: 30,
    maxMedianAbsDistanceErrorPct: 2,
    maxP95AbsDistanceErrorPct: 4,
  },

  /**
   * Real-world shadow mode vs ground truth, before promotion. Every
   * disagreement is human-reviewed; a confirmed engine false verification
   * (engine verified what ground truth failed) resets the counter.
   */
  realWorldShadow: {
    minShadowedRunEvents: 150,
    maxConfirmedFalseVerifications: 0,
    maxFalseFailureRatePct: 1,
    /** Tracked as UX cost, not a safety gate. */
    targetMaxUnableToVerifyRatePct: 20,
  },

  /**
   * Promotion mechanics: an audited verification_policies insert flipping
   * run_gps to 'authoritative'; server-side execution of this exact engine
   * version (no client-computed analysis may ever hold authority); demotion
   * is the same insert in reverse, immediately, if live metrics degrade.
   */
  mechanics: {
    requiresServerSideExecution: true,
    requiresPolicyVersionInsert: true,
    demotionOnLiveDegradation: 'immediate',
  },
} as const;
