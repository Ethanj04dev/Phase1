import { haversineMeters } from './geo';
import {
  RUN_ENGINE_VERSION,
  RUN_RULESET,
  RUN_RULESET_VERSION,
} from './ruleset';
import type {
  RunAnalysis,
  RunAnalysisInput,
  RunAnomalySignal,
  RunSample,
  RunVerdict,
} from './types';

/**
 * The Run Engine: raw device signals in, structured explainable analysis out.
 *
 * Deterministic end to end — same trace, same ruleset, same answer. The
 * pipeline: filter by signal quality → measure distance and time → analyse
 * plausibility and continuity → derive documented confidence dimensions →
 * apply the verdict cascade. FAILED requires positive evidence (a complete
 * good-quality trace that is short, or movement beyond human capability on a
 * clean signal); everything ambiguous abstains.
 */

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

interface Segment {
  dtSeconds: number;
  meters: number;
  /** Distance credited toward the run (teleports and jitter excluded). */
  creditedMeters: number;
  /** Position-derived speed. Governs distance crediting and teleports. */
  speedMps: number;
  /**
   * The smoother behavioural speed: platform (Doppler) speed when the device
   * reported it, position-derived otherwise. Governs stationary and
   * acceleration analysis, where position jitter would shout over behaviour.
   */
  behaviourSpeedMps: number;
  teleport: boolean;
}

/**
 * Elapsed seconds (from the first kept sample) at which the credited
 * cumulative distance crosses `target`, linearly interpolated within the
 * crossing segment. Null when the trace never reaches it.
 */
function elapsedAtDistance(
  times: readonly number[],
  cumulative: readonly number[],
  target: number,
): number | null {
  for (let index = 1; index < cumulative.length; index += 1) {
    if (cumulative[index]! >= target) {
      const previousDistance = cumulative[index - 1]!;
      const span = cumulative[index]! - previousDistance;
      const fraction = span <= 0 ? 1 : (target - previousDistance) / span;
      const previousTime = times[index - 1]!;
      return (previousTime + fraction * (times[index]! - previousTime)) / 1000;
    }
  }
  return null;
}

export function analyzeRun(input: RunAnalysisInput): RunAnalysis {
  const rules = RUN_RULESET;
  const { trace, requiredDistanceMeters, sessionWindow } = input;
  const raw = trace.samples;

  const anomalies: RunAnomalySignal[] = [];
  const reasonCodes: string[] = [];

  const base = {
    engine: 'run_gps' as const,
    engineVersion: RUN_ENGINE_VERSION,
    rulesetVersion: RUN_RULESET_VERSION,
  };

  const elapsedSeconds =
    raw.length >= 2 ? (raw[raw.length - 1]!.t - raw[0]!.t) / 1000 : 0;

  // --- Insufficient data: no measurement can be honest. --------------------
  if (raw.length < rules.minSamples || elapsedSeconds < rules.minDurationSeconds) {
    return {
      ...base,
      verdict: 'unable_to_verify',
      reasonCodes: ['insufficient_data'],
      anomalies,
      rawDistanceMeters: 0,
      computedDistanceMeters: 0,
      acceptedTimeSeconds: null,
      elapsedSeconds,
      quality: {
        sampleCount: raw.length,
        droppedSampleCount: 0,
        medianAccuracyMeters: null,
        coverage: 0,
        gapCount: 0,
        maxGapSeconds: 0,
        nonMonotonicCount: 0,
      },
      pace: {
        averageSpeedMps: null,
        maxSustainedSpeedMps: null,
        stationaryPeriodCount: 0,
        stationarySeconds: 0,
        accelerationSpikeCount: 0,
        quarterSplitsSeconds: null,
      },
      continuity: {
        backgroundInterruptions: 0,
        startedInsideWindow: null,
        endedInsideWindow: null,
      },
      confidences: { signalQuality: 0, continuity: 0, plausibility: 0 },
    };
  }

  // --- Filter: accuracy and clock order. Raw samples are never modified. ---
  const kept: RunSample[] = [];
  let dropped = 0;
  let nonMonotonic = 0;
  for (const sample of raw) {
    if (sample.acc !== null && sample.acc > rules.maxAcceptedAccuracyMeters) {
      dropped += 1;
      continue;
    }
    const previous = kept[kept.length - 1];
    if (previous && sample.t <= previous.t) {
      nonMonotonic += 1;
      dropped += 1;
      continue;
    }
    kept.push(sample);
  }
  // Single-point outlier rejection: a sample the trace teleports INTO and
  // straight back OUT of is a positioning glitch, not two suspicious jumps.
  // One pass, counted and reported; genuine sustained displacement survives.
  let outliersRemoved = 0;
  for (let index = kept.length - 2; index >= 1; index -= 1) {
    const previous = kept[index - 1]!;
    const candidate = kept[index]!;
    const next = kept[index + 1]!;
    const inDt = (candidate.t - previous.t) / 1000;
    const outDt = (next.t - candidate.t) / 1000;
    if (inDt <= 0 || outDt <= 0) {
      continue;
    }
    const inSpeed = haversineMeters(previous.lat, previous.lon, candidate.lat, candidate.lon) / inDt;
    const outSpeed = haversineMeters(candidate.lat, candidate.lon, next.lat, next.lon) / outDt;
    if (inSpeed > rules.teleportSpeedMps && outSpeed > rules.teleportSpeedMps) {
      kept.splice(index, 1);
      outliersRemoved += 1;
      dropped += 1;
    }
  }
  if (outliersRemoved > 0) {
    anomalies.push({
      code: 'gps_outliers_removed',
      severity: 'info',
      detail: `${outliersRemoved} single-point positioning glitch(es) removed before measuring.`,
    });
  }

  const droppedRatio = dropped / raw.length;

  // Raw distance over the samples exactly as recorded, for the record.
  let rawDistance = 0;
  for (let index = 1; index < raw.length; index += 1) {
    rawDistance += haversineMeters(
      raw[index - 1]!.lat,
      raw[index - 1]!.lon,
      raw[index]!.lat,
      raw[index]!.lon,
    );
  }

  // --- Position smoothing for measurement. ---------------------------------
  // A centred 3-point average knocks down white positional jitter, which
  // otherwise inflates distance (every wobble is extra metres). Raw samples
  // are untouched — this is a measurement view, and rawDistance reports the
  // unsmoothed sum beside it.
  const measured = kept.map((sample, index) => {
    if (index === 0 || index === kept.length - 1) {
      return sample;
    }
    const previous = kept[index - 1]!;
    const next = kept[index + 1]!;
    // Never smooth across a sampling gap: averaging over missing seconds
    // drags gap-edge points through space and manufactures false teleports.
    const beforeGap = (sample.t - previous.t) / 1000 > rules.nominalIntervalSeconds;
    const afterGap = (next.t - sample.t) / 1000 > rules.nominalIntervalSeconds;
    if (beforeGap || afterGap) {
      return sample;
    }
    return {
      ...sample,
      lat: (previous.lat + sample.lat + next.lat) / 3,
      lon: (previous.lon + sample.lon + next.lon) / 3,
    };
  });

  // --- Segments over the filtered, smoothed trace. --------------------------
  const segments: Segment[] = [];
  let teleports = 0;
  for (let index = 1; index < measured.length; index += 1) {
    const a = measured[index - 1]!;
    const b = measured[index]!;
    const dtSeconds = (b.t - a.t) / 1000;
    if (dtSeconds <= 0) {
      continue;
    }
    const meters = haversineMeters(a.lat, a.lon, b.lat, b.lon);
    const speedMps = meters / dtSeconds;
    const teleport = speedMps > rules.teleportSpeedMps;
    if (teleport) {
      teleports += 1;
    }
    const credited =
      teleport || speedMps < rules.jitterFloorSpeedMps ? 0 : meters;
    const behaviourSpeedMps =
      a.spd !== null && b.spd !== null ? (a.spd + b.spd) / 2 : speedMps;
    segments.push({
      dtSeconds,
      meters,
      creditedMeters: credited,
      speedMps,
      behaviourSpeedMps,
      teleport,
    });
  }

  if (teleports > 0) {
    anomalies.push({
      code: 'teleport_segments',
      severity: teleports > rules.maxTeleports ? 'high_risk' : 'suspicious',
      detail: `${teleports} segment(s) exceeded ${rules.teleportSpeedMps} m/s and were excluded from distance.`,
    });
  }

  // Cumulative credited distance and elapsed times for interpolation.
  const times: number[] = [0];
  const cumulative: number[] = [0];
  const t0 = kept[0]?.t ?? raw[0]!.t;
  let runningDistance = 0;
  for (let index = 0; index < segments.length; index += 1) {
    runningDistance += segments[index]!.creditedMeters;
    times.push(kept[index + 1]!.t - t0);
    cumulative.push(runningDistance);
  }
  const computedDistance = runningDistance;
  const keptElapsedSeconds =
    kept.length >= 2 ? (kept[kept.length - 1]!.t - kept[0]!.t) / 1000 : 0;

  // --- Quality metrics. -----------------------------------------------------
  const accuracies = kept
    .map((sample) => sample.acc)
    .filter((value): value is number => value !== null);
  const medianAccuracy = median(accuracies);

  let coveredSeconds = 0;
  let gapCount = 0;
  let maxGap = 0;
  for (const segment of segments) {
    coveredSeconds += Math.min(segment.dtSeconds, rules.nominalIntervalSeconds);
    if (segment.dtSeconds > rules.nominalIntervalSeconds) {
      gapCount += 1;
    }
    maxGap = Math.max(maxGap, segment.dtSeconds);
  }
  const coverage = keptElapsedSeconds > 0 ? clamp01(coveredSeconds / keptElapsedSeconds) : 0;

  // --- Pace metrics. --------------------------------------------------------
  const averageSpeed =
    keptElapsedSeconds > 0 ? computedDistance / keptElapsedSeconds : null;

  // Fastest sustained speed over the rolling window (two pointers).
  let maxSustained: number | null = null;
  let left = 0;
  for (let right = 1; right < times.length; right += 1) {
    while (times[right]! - times[left]! > rules.sustainedWindowSeconds * 1000 * 2) {
      left += 1;
    }
    for (let probe = left; probe < right; probe += 1) {
      const spanSeconds = (times[right]! - times[probe]!) / 1000;
      if (spanSeconds >= rules.sustainedWindowSeconds) {
        const speed = (cumulative[right]! - cumulative[probe]!) / spanSeconds;
        if (maxSustained === null || speed > maxSustained) {
          maxSustained = speed;
        }
      }
    }
  }

  let stationaryPeriods = 0;
  let stationarySeconds = 0;
  let currentStationary = 0;
  for (const segment of segments) {
    if (segment.behaviourSpeedMps < rules.stationarySpeedMps) {
      currentStationary += segment.dtSeconds;
    } else {
      if (currentStationary >= rules.stationaryMinSeconds) {
        stationaryPeriods += 1;
        stationarySeconds += currentStationary;
      }
      currentStationary = 0;
    }
  }
  if (currentStationary >= rules.stationaryMinSeconds) {
    stationaryPeriods += 1;
    stationarySeconds += currentStationary;
  }
  if (stationaryPeriods > 0) {
    anomalies.push({
      code: 'stationary_periods',
      severity: 'info',
      detail: `${stationaryPeriods} stationary period(s) totalling ${Math.round(stationarySeconds)}s. Stopping is legal; noted for review.`,
    });
  }

  let accelerationSpikes = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const deltaV = Math.abs(
      segments[index]!.behaviourSpeedMps - segments[index - 1]!.behaviourSpeedMps,
    );
    const dt = segments[index]!.dtSeconds;
    if (dt > 0 && deltaV / dt > rules.accelerationSpikeMps2) {
      accelerationSpikes += 1;
    }
  }
  const spikeRatio = segments.length > 0 ? accelerationSpikes / segments.length : 0;

  const quarterTargets = [0.25, 0.5, 0.75, 1].map(
    (fraction) => requiredDistanceMeters * fraction,
  );
  const quarterSplits =
    computedDistance >= requiredDistanceMeters
      ? quarterTargets.map((target) => elapsedAtDistance(times, cumulative, target) ?? 0)
      : null;

  // --- Continuity. ----------------------------------------------------------
  const backgroundInterruptions = trace.events.filter(
    (event) => event.type === 'app_background',
  ).length;
  if (backgroundInterruptions > 0) {
    anomalies.push({
      code: 'app_backgrounded',
      severity: 'suspicious',
      detail: `The app went to the background ${backgroundInterruptions} time(s) during tracking.`,
    });
  }

  const slackMs = rules.sessionWindowSlackSeconds * 1000;
  const startedInsideWindow = sessionWindow
    ? raw[0]!.t >= sessionWindow.openedAtMs - slackMs
    : null;
  const endedInsideWindow = sessionWindow
    ? raw[raw.length - 1]!.t <= sessionWindow.closedAtMs + slackMs
    : null;

  // --- Confidence dimensions (documented formulas, ruleset-governed). -------
  // signalQuality: the weakest of accuracy (5m→1.0, 50m→0.0), sampling
  // coverage, and the fraction of samples kept.
  const accuracyScore =
    medianAccuracy === null ? 0.5 : clamp01(1 - (medianAccuracy - 5) / 45);
  const signalQuality = clamp01(Math.min(accuracyScore, coverage, 1 - droppedRatio));

  let continuityScore = 1;
  continuityScore -= backgroundInterruptions * 0.4;
  if (maxGap > rules.maxGapSeconds) {
    continuityScore -= 0.3;
  }
  if (startedInsideWindow === false || endedInsideWindow === false) {
    continuityScore = Math.min(continuityScore, 0.2);
  }
  const continuityConfidence = clamp01(continuityScore);

  let plausibilityScore = 1;
  plausibilityScore -= teleports * 0.25;
  if (maxSustained !== null && maxSustained >= rules.suspectSustainedSpeedMps) {
    plausibilityScore = Math.min(plausibilityScore, 0.2);
    anomalies.push({
      code: 'sustained_speed_beyond_human_record',
      severity: 'high_risk',
      detail: `Sustained ${maxSustained.toFixed(1)} m/s over ${rules.sustainedWindowSeconds}s exceeds recorded human running.`,
    });
  }
  if (spikeRatio > rules.maxSpikeRatio) {
    plausibilityScore -= 0.35;
    anomalies.push({
      code: 'acceleration_spikes',
      severity: 'suspicious',
      detail: `Speed changes exceeded ${rules.accelerationSpikeMps2} m/s² on ${Math.round(spikeRatio * 100)}% of segments.`,
    });
  }
  const plausibilityConfidence = clamp01(plausibilityScore);

  // --- Verdict cascade. -----------------------------------------------------
  let verdict: RunVerdict;
  const requiredWithTolerance =
    requiredDistanceMeters * (1 - rules.distanceShortfallTolerance);
  const qualityPass =
    signalQuality >= rules.minSignalQualityConfidence &&
    coverage >= rules.minCoverage;

  if (nonMonotonic > rules.maxNonMonotonic) {
    verdict = 'unable_to_verify';
    reasonCodes.push('timestamp_anomaly');
    anomalies.push({
      code: 'timestamp_anomaly',
      severity: 'high_risk',
      detail: `${nonMonotonic} samples ran backwards in time.`,
    });
  } else if (startedInsideWindow === false || endedInsideWindow === false) {
    verdict = 'unable_to_verify';
    reasonCodes.push('outside_session_window');
    anomalies.push({
      code: 'outside_session_window',
      severity: 'high_risk',
      detail: 'Trace time falls outside the server-clocked event window.',
    });
  } else if (
    maxSustained !== null &&
    maxSustained >= rules.impossibleSustainedSpeedMps
  ) {
    // Beyond human capability. With a clean signal this is positive evidence
    // of vehicle use or manipulation; on a dirty signal, abstain.
    if (qualityPass) {
      verdict = 'failed';
      reasonCodes.push('impossible_speed');
    } else {
      verdict = 'unable_to_verify';
      reasonCodes.push('impossible_speed_low_quality');
    }
  } else if (computedDistance < requiredWithTolerance) {
    // Short of the protocol distance. Positive finding only when the trace
    // is trustworthy enough that the shortfall is real.
    if (qualityPass && teleports === 0) {
      verdict = 'failed';
      reasonCodes.push('insufficient_distance');
    } else {
      verdict = 'unable_to_verify';
      reasonCodes.push('insufficient_distance_low_quality');
    }
  } else if (!qualityPass) {
    verdict = 'unable_to_verify';
    if (medianAccuracy !== null && medianAccuracy > rules.qualityMedianAccuracyMeters) {
      reasonCodes.push('poor_gps_accuracy');
    }
    if (coverage < rules.minCoverage) {
      reasonCodes.push('sampling_gaps');
    }
    if (droppedRatio > rules.maxDroppedRatio) {
      reasonCodes.push('excessive_dropped_samples');
    }
    if (reasonCodes.length === 0) {
      reasonCodes.push('poor_signal_quality');
    }
  } else if (continuityConfidence < rules.minContinuityConfidence) {
    verdict = 'unable_to_verify';
    reasonCodes.push('continuity_interrupted');
  } else if (plausibilityConfidence < rules.minPlausibilityConfidence) {
    verdict = 'unable_to_verify';
    reasonCodes.push('implausible_movement');
  } else {
    verdict = 'verified';
  }

  const acceptedTime =
    verdict === 'verified'
      ? elapsedAtDistance(times, cumulative, requiredDistanceMeters)
      : null;

  return {
    ...base,
    verdict,
    reasonCodes,
    anomalies,
    rawDistanceMeters: Math.round(rawDistance * 10) / 10,
    computedDistanceMeters: Math.round(computedDistance * 10) / 10,
    acceptedTimeSeconds: acceptedTime === null ? null : Math.round(acceptedTime * 10) / 10,
    elapsedSeconds: Math.round(elapsedSeconds * 10) / 10,
    quality: {
      sampleCount: raw.length,
      droppedSampleCount: dropped,
      medianAccuracyMeters: medianAccuracy,
      coverage: Math.round(coverage * 1000) / 1000,
      gapCount,
      maxGapSeconds: Math.round(maxGap * 10) / 10,
      nonMonotonicCount: nonMonotonic,
    },
    pace: {
      averageSpeedMps: averageSpeed === null ? null : Math.round(averageSpeed * 100) / 100,
      maxSustainedSpeedMps:
        maxSustained === null ? null : Math.round(maxSustained * 100) / 100,
      stationaryPeriodCount: stationaryPeriods,
      stationarySeconds: Math.round(stationarySeconds),
      accelerationSpikeCount: accelerationSpikes,
      quarterSplitsSeconds:
        quarterSplits === null
          ? null
          : quarterSplits.map((split) => Math.round(split * 10) / 10),
    },
    continuity: {
      backgroundInterruptions,
      startedInsideWindow,
      endedInsideWindow,
    },
    confidences: {
      signalQuality: Math.round(signalQuality * 1000) / 1000,
      continuity: Math.round(continuityConfidence * 1000) / 1000,
      plausibility: Math.round(plausibilityConfidence * 1000) / 1000,
    },
  };
}
