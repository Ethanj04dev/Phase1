/**
 * The Run Engine's input and output shapes.
 *
 * This module is deliberately dependency-free pure TypeScript: no React, no
 * Expo, no Supabase. The same code that runs in shadow mode today must run
 * unchanged inside a server function when the engine is promoted to
 * authority, and it must be exhaustively testable in jest. Anything that
 * would tie it to a platform belongs in the capture layer, not here.
 */

/** One raw GPS sample, exactly as the device reported it. Never edited. */
export interface RunSample {
  /** Epoch milliseconds, device clock. */
  t: number;
  lat: number;
  lon: number;
  /** Horizontal accuracy in metres. Null when the platform withheld it. */
  acc: number | null;
  /** Altitude in metres, when available. */
  alt: number | null;
  /** Platform-reported instantaneous speed in m/s, when available. */
  spd: number | null;
}

/** Capture-lifecycle events, recorded beside the samples. */
export type RunTraceEventType =
  | 'tracking_start'
  | 'tracking_stop'
  | 'app_background'
  | 'app_foreground';

export interface RunTraceEvent {
  t: number;
  type: RunTraceEventType;
}

/**
 * The raw trace: what the evidence file contains. Preserved verbatim as
 * uploaded evidence; the engine derives from it and never rewrites it.
 */
export interface RunTrace {
  /** Trace format version, independent of engine versions. */
  formatVersion: 1;
  samples: readonly RunSample[];
  events: readonly RunTraceEvent[];
}

export interface RunAnalysisInput {
  trace: RunTrace;
  /** What the protocol requires. The engine measures against this. */
  requiredDistanceMeters: number;
  /**
   * The server-clocked event window, when analysing inside a session.
   * Trace time outside this window (plus slack) is a continuity finding.
   */
  sessionWindow?: { openedAtMs: number; closedAtMs: number };
}

export type RunVerdict = 'verified' | 'failed' | 'unable_to_verify';

export interface RunAnomalySignal {
  code: string;
  severity: 'info' | 'suspicious' | 'high_risk';
  /** Human-readable one-liner for the console. */
  detail: string;
}

/** Everything the engine measured, structured for storage and audit. */
export interface RunAnalysis {
  engine: 'run_gps';
  engineVersion: string;
  rulesetVersion: number;

  verdict: RunVerdict;
  reasonCodes: readonly string[];
  anomalies: readonly RunAnomalySignal[];

  /** Metres over the raw, unfiltered samples. Reported, never used alone. */
  rawDistanceMeters: number;
  /** Metres over the filtered trace — the measurement that counts. */
  computedDistanceMeters: number;
  /**
   * Elapsed seconds when the filtered trace crosses exactly the required
   * distance, linearly interpolated. Null when it never gets there or the
   * verdict is not verified.
   */
  acceptedTimeSeconds: number | null;
  /**
   * Explicit measurement uncertainty on the computed distance, metres. A
   * verified verdict requires clearing the required distance by this margin;
   * a crossing inside the band abstains rather than guessing.
   */
  distanceUncertaintyMeters: number;
  /** The distance uncertainty expressed as seconds at the crossing pace. */
  acceptedTimeUncertaintySeconds: number | null;
  /** Total elapsed seconds from first to last sample. */
  elapsedSeconds: number;
  /**
   * Coarse route shape fingerprint. Not spoof detection — an interface for
   * future cross-attempt route-similarity checks. Null when unmeasurable.
   */
  routeFingerprint: string | null;

  quality: {
    sampleCount: number;
    droppedSampleCount: number;
    medianAccuracyMeters: number | null;
    /** Fraction of the elapsed time covered by nominal sampling. */
    coverage: number;
    gapCount: number;
    maxGapSeconds: number;
    nonMonotonicCount: number;
  };

  pace: {
    averageSpeedMps: number | null;
    /** Fastest 60-second rolling average speed. */
    maxSustainedSpeedMps: number | null;
    stationaryPeriodCount: number;
    stationarySeconds: number;
    accelerationSpikeCount: number;
    /** Elapsed seconds per quarter of the computed distance, for splits. */
    quarterSplitsSeconds: readonly number[] | null;
  };

  continuity: {
    backgroundInterruptions: number;
    startedInsideWindow: boolean | null;
    endedInsideWindow: boolean | null;
  };

  /**
   * Deterministic 0–1 dimensions derived from the measurements above.
   * Not learned, not guessed — each has a documented formula in the ruleset,
   * so a threshold change is a ruleset version, not a vibe.
   */
  confidences: {
    signalQuality: number;
    continuity: number;
    plausibility: number;
  };
}
