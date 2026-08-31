/**
 * Run Engine ruleset, version 1. Every threshold the engine consults lives
 * here, documented, so changing one is a visible, versioned decision rather
 * than an edit buried in analysis code.
 *
 * The stance throughout is the product's: FAILED needs positive evidence of
 * invalidity; suspicion and bad signal abstain. A fast athlete must never
 * fail for being fast — the impossible-speed bound is set beyond recorded
 * human capability, not at "faster than expected".
 */

export const RUN_ENGINE_NAME = 'run_gps' as const;
export const RUN_ENGINE_VERSION = '2';
export const RUN_RULESET_VERSION = 2;

export const RUN_RULESET = {
  /** Below this the trace cannot support any conclusion. */
  minSamples: 60,
  minDurationSeconds: 60,

  /** Samples with worse horizontal accuracy are dropped before measuring. */
  maxAcceptedAccuracyMeters: 30,
  /** A quality-passing trace has median accuracy at or under this. */
  qualityMedianAccuracyMeters: 25,
  /** More than this fraction of samples dropped → quality concern. */
  maxDroppedRatio: 0.25,

  /** Nominal sampling is ~1 Hz; an interval beyond this counts as a gap. */
  nominalIntervalSeconds: 5,
  /** Any single gap beyond this is a continuity finding on its own. */
  maxGapSeconds: 30,
  /** Coverage below this abstains: too much of the run is unobserved. */
  minCoverage: 0.9,

  /**
   * Segment speed above this is treated as a positioning jump (teleport):
   * the segment's distance is excluded and an anomaly recorded. Set well
   * above sprint speed so no human movement ever trips it.
   */
  teleportSpeedMps: 15,
  /** More teleports than this abstains even if distance still clears. */
  maxTeleports: 2,

  /**
   * Sustained speed (60s rolling) above `impossible` is beyond recorded
   * human running by a wide margin (the mile record averages ~7.2 m/s) —
   * with good signal quality that is positive evidence of vehicle use or
   * trace manipulation. Between `suspect` and `impossible`, or with poor
   * quality, the engine abstains instead.
   */
  sustainedWindowSeconds: 60,
  suspectSustainedSpeedMps: 7.4,
  impossibleSustainedSpeedMps: 9.5,

  /** Below this speed a sample contributes no distance (jitter floor). */
  jitterFloorSpeedMps: 0.3,
  /** Stationary period definition — a signal, never an offence. */
  stationarySpeedMps: 0.5,
  stationaryMinSeconds: 20,

  /** |Δspeed|/Δt beyond this between samples counts as an accel spike. */
  accelerationSpikeMps2: 4,
  /** Spikes on more than this fraction of segments → quality concern. */
  maxSpikeRatio: 0.1,

  /**
   * Distance shortfall tolerance: within half a percent of required is
   * measurement noise, not a shortfall.
   */
  distanceShortfallTolerance: 0.005,

  /** Trace may start/end this far outside the server event window. */
  sessionWindowSlackSeconds: 60,
  /** Device-clock stutter happens; more than this many abstains. */
  maxNonMonotonic: 2,

  /** Minimum confidence dimensions for a verified verdict. */
  minSignalQualityConfidence: 0.7,
  minContinuityConfidence: 0.7,
  minPlausibilityConfidence: 0.7,

  // --- Ruleset v2: distance estimation and uncertainty ----------------------

  /**
   * The distance pipeline in force. Selected by the benchmark
   * (src/domain/runEngine/benchmark.test.ts), not by taste: the report in
   * docs/benchmarks/ carries the measured error of every candidate.
   */
  distancePipeline: 'kalman_stride' as
    | 'smooth3'
    | 'stride'
    | 'kalman'
    | 'kalman_stride',
  /** Polyline stride for the plain stride pipeline. */
  strideSeconds: 5,
  /**
   * Distance-based stride applied after Kalman filtering: a polyline point
   * per ~14m of movement (or 10s, so stationary spells cannot stall it).
   */
  strideMinMeters: 14,
  strideMaxSeconds: 10,
  /** Kalman process noise: expected acceleration variance, (m/s²)². */
  kalmanProcessNoise: 3,

  /**
   * Distance uncertainty model: c × effectiveAccuracy × √(polyline points),
   * floored and capped. The benchmark measures how often the real error
   * lands inside this bound; the coefficient is calibrated there, and will
   * be re-calibrated against real device traces.
   */
  uncertaintyCoefficient: 0.35,
  uncertaintyFloorMeters: 10,
  uncertaintyCapMeters: 150,
} as const;
