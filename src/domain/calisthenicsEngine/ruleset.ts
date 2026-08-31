/**
 * Calisthenics ruleset, version 1 — pull-ups.
 *
 * EVERY NUMBER IN THIS FILE IS PROVISIONAL. These are engineering starting
 * points chosen to build and test the machinery — they are NOT claims about
 * the official IFT standard and NOT production-ready biomechanics. Protocol
 * research and real labeled footage replace them; each replacement is a new
 * ruleset version, and historical analyses keep the version they were
 * judged under.
 *
 * The stance mirrors the Run Engine's: FAILED-class findings need positive
 * evidence; ambiguity resolves to uncertainty and abstention; nothing here
 * is ever an authoritative verdict — the analyzer recommends, policy
 * decides.
 */

export const CALISTHENICS_ENGINE_NAME = 'calisthenics_pose' as const;
export const CALISTHENICS_ENGINE_VERSION = '1';
export const CALISTHENICS_RULESET_VERSION = 1;

export const CALISTHENICS_RULESET = {
  /** PROVISIONAL throughout — see file header. */
  provisional: true as const,

  // --- Stream sufficiency ----------------------------------------------------
  minFrames: 60,
  minDurationSeconds: 5,
  minFps: 10,

  // --- Extension / hang geometry (degrees at the elbow) ----------------------
  /** Elbow angle at or above which the arm counts as extended (lockout). */
  extensionAngleDeg: 160,
  /** Within this band below the threshold, lockout is uncertain, not failed. */
  extensionUncertaintyDeg: 6,
  /** Angle at or above which a frame reads as hanging (slightly lenient). */
  hangAngleDeg: 155,
  /** Flexion below this marks a genuine pull attempt in progress. */
  startPullAngleDeg: 140,
  /** Frames of stable hang required before the first attempt can begin. */
  minHangFrames: 6,

  // --- Chin-over-bar ----------------------------------------------------------
  /**
   * Required clearance above the bar line, expressed BOTH as an absolute
   * floor (normalized image units) and as a multiple of the bar
   * reference's own uncertainty — a better bar provider automatically
   * tightens judgment. The larger of the two applies; inside the band on
   * either side of the requirement, the rep is uncertain.
   */
  chinClearanceFloor: 0.01,
  chinClearanceUncertaintyMultiple: 1.5,

  // --- Visibility --------------------------------------------------------------
  /** Mean core visibility below this makes a rep uncertain. */
  repVisibilityFloor: 0.6,
  /** Core visibility below this for longer than maxFramingLossSeconds
   *  abstains the event: the camera lost the athlete. */
  framingVisibilityFloor: 0.35,
  maxFramingLossSeconds: 2,

  // --- Kipping (owner decision 1: flag, resolve to uncertain, never
  //     auto-invalidate in v1; a future protocol may select 'invalidate'
  //     as its own ruleset version) ------------------------------------------
  kippingPolicy: 'flag_uncertain' as 'flag_uncertain' | 'invalidate',
  /** Hip horizontal oscillation, in torso-length units, above which a rep
   *  is flagged as kipping. */
  kippingAmplitudeTorsoUnits: 0.35,

  // --- Cadence -----------------------------------------------------------------
  /** A full rep faster than this is beyond plausible strict pull-ups. */
  minRepSeconds: 0.8,
  /** This many implausibly fast reps abstains the event. */
  maxImplausibleCadenceReps: 2,

  // --- Event-level abstention --------------------------------------------------
  /** Uncertain reps above this fraction of detected reps abstain the event. */
  maxUncertainRepFraction: 0.15,
  /** Confidently-judged attempts with zero valid among at least this many
   *  recommends fail_candidate (systematic protocol violation). */
  minAttemptsForFailRecommendation: 3,

  // --- Signal conditioning -----------------------------------------------------
  /** EMA smoothing factor for chin height and elbow angle signals. */
  smoothingAlpha: 0.4,

  // --- Bar reference (v1 provider) --------------------------------------------
  /** Minimum uncertainty ever attributed to a bar estimate. */
  barUncertaintyFloor: 0.005,
} as const;
