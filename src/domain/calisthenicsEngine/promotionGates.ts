/**
 * Calisthenics engine gates — TWO STAGES, per owner decision 5.
 *
 * Stage 1 (prototype/shadow) governs whether the analyzer is worth
 * shadowing broadly. It confers NO authority.
 *
 * Stage 2 (authoritative promotion) is a separate, later, harder bar:
 * near-zero false credit, thresholds EMPIRICALLY CALIBRATED from real
 * shadow data — the numeric fields below are deliberately null until that
 * data exists and the owner approves the calibrated values.
 *
 * Event-level false credit (accepted count above ground truth) is the
 * primary safety metric at both stages.
 */

export const CALISTHENICS_GATES_VERSION = 1;

export const CALISTHENICS_STAGE1_GATES = {
  /** Per-rep judgment quality on benchmark + labeled corpus. */
  minValidRepPrecision: 0.97,
  minInvalidRepDetection: 0.9,
  /** Event count agreement with ground truth. */
  minExactCountAgreement: 0.9,
  minWithinOneAgreement: 0.99,
  /** accepted > truth on benchmark/adversarial: disqualifying. */
  maxFalseCreditEvents: 0,
  maxFalseFailureRate: 0.01,
  /** Tracked as UX cost, not a safety gate. */
  targetMaxUnableToVerifyRate: 0.25,
  adversarialPassRate: 1.0,
  /** Seed corpus floor, subject to the diversity ledger below. */
  minLabeledVideos: 40,
} as const;

/**
 * Diversity is measured at the athlete/session level (owner decision 6):
 * clip volume never masquerades as coverage. The corpus ledger tracks per
 * sample: athlete (pseudonymous), session, device/camera model, angle and
 * distance class, lighting class, environment, clothing/background
 * contrast, body-proportion class, movement style, and per-rep label
 * counts with failure modes.
 */
export const CALISTHENICS_DIVERSITY_FLOORS = {
  minAthletes: 12,
  maxShareOfLabeledRepsPerAthlete: 0.15,
  minAthletesPerCameraAngleClass: 3,
  minAthletesPerLightingClass: 3,
  minAthletesPerEnvironmentClass: 3,
} as const;

export const CALISTHENICS_STAGE2_GATES = {
  /**
   * Requirements of FORM, fixed now; numbers arrive from measured shadow
   * data and owner approval — never from this file being edited ahead of
   * the evidence.
   */
  requiresServerWorkerExecution: true,
  requiresParityPinnedAnalyzer: true,
  requiresAuditedPolicyInsert: true,
  demotionOnLiveDegradation: 'immediate',
  requiresOwnerApprovalOfCalibratedThresholds: true,
  /** Filled from real-world shadow calibration; null = not yet earned. */
  calibratedThresholds: null as null | {
    minShadowedEvents: number;
    maxConfirmedFalseCredits: number;
    maxFalseFailureRate: number;
    minCalibrationScore: number;
  },
} as const;
