/**
 * The Calisthenics Rep Analyzer's input and output shapes.
 *
 * Dependency-free pure TypeScript, like the Run Engine: the same code runs
 * in jest, in the review console, and — on the promotion path — in the
 * server worker, unchanged.
 *
 * The division of labour is fixed by design: pose estimation OBSERVES
 * (video → landmark streams, an established versioned component);
 * this analyzer DECIDES what those observations mean under a versioned
 * ruleset; and only server policy ever turns any of it into an
 * authoritative Zero Phase verdict. Accordingly, this module's output is a
 * RECOMMENDATION — `pass_candidate | fail_candidate | unable_to_verify` —
 * and deliberately cannot express "verified".
 */

/** One 2D point in normalized image space (x right, y DOWN), with trust. */
export interface LandmarkPoint {
  x: number;
  y: number;
  /** 0–1, from the extractor. 0 = not seen this frame. */
  visibility: number;
}

/**
 * The canonical landmark set the analyzer consumes — extractor-agnostic.
 * Adapters (M3C-2) map MediaPipe/MoveNet-class outputs onto these names.
 */
export interface CalisthenicsLandmarks {
  chin: LandmarkPoint;
  leftWrist: LandmarkPoint;
  rightWrist: LandmarkPoint;
  leftElbow: LandmarkPoint;
  rightElbow: LandmarkPoint;
  leftShoulder: LandmarkPoint;
  rightShoulder: LandmarkPoint;
  leftHip: LandmarkPoint;
  rightHip: LandmarkPoint;
  leftKnee: LandmarkPoint;
  rightKnee: LandmarkPoint;
  leftAnkle: LandmarkPoint;
  rightAnkle: LandmarkPoint;
}

export interface LandmarkFrame {
  /** Milliseconds from stream start. */
  tMs: number;
  landmarks: CalisthenicsLandmarks;
}

/** The derived artifact a pose extractor produces from evidence video. */
export interface LandmarkStream {
  formatVersion: 1;
  /** Extractor identity, stamped by whoever produced the stream. */
  extractorName: string;
  extractorVersion: string;
  /** The evidence this stream was derived from (id and content hash). */
  sourceEvidenceId: string | null;
  sourceEvidenceHash: string | null;
  frames: readonly LandmarkFrame[];
}

/**
 * Where the bar is — as far as the analyzer cares. The analyzer consumes a
 * BarReference and never knows how it was obtained; the v1 provider infers
 * it from wrist positions during the hang, a future provider may detect
 * the physical bar. Swapping providers never touches the rep engine.
 */
export interface BarReference {
  provider: string;
  providerVersion: string;
  /** Bar line in normalized image y (smaller = higher in frame). */
  lineY: number;
  /** Uncertainty of the line estimate, same units. */
  uncertainty: number;
}

export interface CalisthenicsAnalysisInput {
  stream: LandmarkStream;
  /**
   * Optional externally supplied bar reference. When absent, the ruleset's
   * default provider derives one from the stream itself.
   */
  barReference?: BarReference;
}

export type RepVerdict = 'valid' | 'invalid' | 'uncertain';

/**
 * The analyzer's event-level output vocabulary. Deliberately NOT the
 * verification verdict vocabulary: nothing this module emits can be
 * mistaken for an authoritative Zero Phase verification. Server policy
 * alone maps recommendations into verdicts.
 */
export type AnalysisRecommendation =
  | 'pass_candidate'
  | 'fail_candidate'
  | 'unable_to_verify';

export interface RepRecord {
  repNumber: number;
  startMs: number;
  endMs: number;
  verdict: RepVerdict;
  reasonCodes: readonly string[];
  /** 0–1: how confidently this rep was judged. */
  confidence: number;
  metrics: {
    /** Highest chin point reached, relative to the bar line: positive = above. */
    chinClearance: number;
    /** Best elbow extension reached in the return phase, degrees. */
    lockoutAngleDeg: number;
    /** Deepest elbow flexion during the pull, degrees. */
    bottomAngleDeg: number;
    /** Horizontal hip oscillation during the rep, in torso-length units. */
    hipSwingAmplitude: number;
    /** Mean core-landmark visibility across the rep. */
    meanVisibility: number;
    durationSeconds: number;
  };
}

/**
 * Optional diagnostics the analyzer can fill while it works — the raw
 * material for overlay and signal views, so a human can look at any
 * decision and see exactly why the machine made it. Populating this changes
 * nothing about the analysis itself.
 */
export interface PullUpDiagnosticsFrame {
  tMs: number;
  phase: 'seeking' | 'hang' | 'pull' | 'return' | 'blind';
  angleDeg: number | null;
  chinY: number | null;
  hipX: number | null;
  coreVisibility: number;
}

export interface PullUpDiagnostics {
  frames: PullUpDiagnosticsFrame[];
  observationGaps: { startMs: number; endMs: number }[];
}

export interface CalisthenicsAnomaly {
  code: string;
  severity: 'info' | 'suspicious' | 'high_risk';
  detail: string;
}

export interface CalisthenicsAnalysis {
  engine: 'calisthenics_pose';
  engineVersion: string;
  rulesetVersion: number;
  exercise: 'pull_ups';
  extractorName: string;
  extractorVersion: string;
  barReference: BarReference | null;

  recommendation: AnalysisRecommendation;
  reasonCodes: readonly string[];
  anomalies: readonly CalisthenicsAnomaly[];

  /** Every attempt the state machine segmented. */
  detectedReps: number;
  /** Valid reps only. Uncertain reps are never credited. */
  acceptedReps: number;
  uncertainReps: number;
  invalidReps: number;
  reps: readonly RepRecord[];

  /** Elapsed milliseconds covered by the stream. */
  elapsedMs: number;

  confidences: {
    /** Mean core-landmark visibility across the stream. */
    landmarkVisibility: number;
    /** Fraction of the stream with the body judgeably in frame. */
    framing: number;
    /** Fraction of detected reps judged confidently (valid or invalid). */
    repJudgment: number;
  };
}
