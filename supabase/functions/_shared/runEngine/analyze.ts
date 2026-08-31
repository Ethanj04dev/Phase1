import { measurePath, prepareSamples } from './filtering.ts';
import { haversineMeters } from './geo.ts';
import {
  RUN_ENGINE_VERSION,
  RUN_RULESET,
  RUN_RULESET_VERSION,
} from './ruleset.ts';
import type {
  RunAnalysis,
  RunAnalysisInput,
  RunAnomalySignal,
  RunVerdict,
} from './types.ts';

/**
 * The Run Engine: raw device signals in, structured explainable analysis out.
 *
 * Deterministic end to end — same trace, same ruleset, same answer. The
 * pipeline: prepare (accuracy, clock order, outliers) → measure distance
 * through the ruleset's selected pipeline → estimate measurement uncertainty
 * explicitly → analyse behaviour, plausibility and continuity → apply the
 * verdict cascade.
 *
 * The distance stance is conservative by construction: a verified verdict
 * requires clearing the protocol distance by the measurement uncertainty; a
 * crossing inside the uncertainty band abstains. FAILED still requires
 * positive evidence — a trustworthy trace that is short beyond the band, or
 * movement beyond human capability on a clean signal.
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

/**
 * Elapsed seconds (from the first polyline time) at which credited
 * cumulative distance crosses `target`, linearly interpolated.
 */
function elapsedAtDistance(
  timesMs: readonly number[],
  cumulative: readonly number[],
  target: number,
): number | null {
  const t0 = timesMs[0];
  if (t0 === undefined) {
    return null;
  }
  for (let index = 1; index < cumulative.length; index += 1) {
    if (cumulative[index]! >= target) {
      const previousDistance = cumulative[index - 1]!;
      const span = cumulative[index]! - previousDistance;
      const fraction = span <= 0 ? 1 : (target - previousDistance) / span;
      const previousTime = timesMs[index - 1]!;
      return (previousTime + fraction * (timesMs[index]! - previousTime) - t0) / 1000;
    }
  }
  return null;
}

/** djb2 over a coarse quantised path — a shape id, not a security feature. */
function fingerprintRoute(samples: readonly { t: number; lat: number; lon: number }[]): string | null {
  if (samples.length < 2) {
    return null;
  }
  let hash = 5381;
  let lastT = -Infinity;
  for (const sample of samples) {
    if (sample.t - lastT < 30_000) {
      continue;
    }
    lastT = sample.t;
    const token = `${sample.lat.toFixed(4)},${sample.lon.toFixed(4)}`;
    for (let index = 0; index < token.length; index += 1) {
      hash = ((hash << 5) + hash + token.charCodeAt(index)) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
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

  if (raw.length < rules.minSamples || elapsedSeconds < rules.minDurationSeconds) {
    return {
      ...base,
      verdict: 'unable_to_verify',
      reasonCodes: ['insufficient_data'],
      anomalies,
      rawDistanceMeters: 0,
      computedDistanceMeters: 0,
      acceptedTimeSeconds: null,
      distanceUncertaintyMeters: 0,
      acceptedTimeUncertaintySeconds: null,
      elapsedSeconds,
      routeFingerprint: null,
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

  // --- Prepare and measure. -------------------------------------------------
  const prepared = prepareSamples(raw, rules);
  const { kept, nonMonotonic, outliersRemoved } = prepared;
  let { dropped } = prepared;
  const droppedRatio = dropped / raw.length;

  if (outliersRemoved > 0) {
    anomalies.push({
      code: 'gps_outliers_removed',
      severity: 'info',
      detail: `${outliersRemoved} single-point positioning glitch(es) removed before measuring.`,
    });
  }

  let rawDistance = 0;
  for (let index = 1; index < raw.length; index += 1) {
    rawDistance += haversineMeters(
      raw[index - 1]!.lat,
      raw[index - 1]!.lon,
      raw[index]!.lat,
      raw[index]!.lon,
    );
  }

  const measured = measurePath(kept, rules.distancePipeline, rules);
  const computedDistance = measured.computedMeters;
  const teleports = measured.teleports;

  if (teleports > 0) {
    anomalies.push({
      code: 'teleport_segments',
      severity: teleports > rules.maxTeleports ? 'high_risk' : 'suspicious',
      detail: `${teleports} positioning jump(s) exceeded ${rules.teleportSpeedMps} m/s; no distance was credited across them.`,
    });
  }

  const keptElapsedSeconds =
    kept.length >= 2 ? (kept[kept.length - 1]!.t - kept[0]!.t) / 1000 : 0;

  // --- Quality metrics (over kept samples, pipeline-independent). -----------
  const accuracies = kept
    .map((sample) => sample.acc)
    .filter((value): value is number => value !== null);
  const medianAccuracy = median(accuracies);

  let coveredSeconds = 0;
  let gapCount = 0;
  let maxGap = 0;
  for (let index = 1; index < kept.length; index += 1) {
    const dt = (kept[index]!.t - kept[index - 1]!.t) / 1000;
    if (dt <= 0) {
      continue;
    }
    coveredSeconds += Math.min(dt, rules.nominalIntervalSeconds);
    if (dt > rules.nominalIntervalSeconds) {
      gapCount += 1;
    }
    maxGap = Math.max(maxGap, dt);
  }
  const coverage =
    keptElapsedSeconds > 0 ? clamp01(coveredSeconds / keptElapsedSeconds) : 0;

  // --- Measurement uncertainty. --------------------------------------------
  // c × effectiveAccuracy × √(polyline points): each polyline segment
  // contributes noise proportional to positional accuracy; independent
  // contributions grow with the square root of their count. Calibrated by
  // the benchmark, re-calibrated on real traces.
  const effectiveAccuracy = medianAccuracy ?? 15;
  const distanceUncertainty = Math.min(
    rules.uncertaintyCapMeters,
    Math.max(
      rules.uncertaintyFloorMeters,
      rules.uncertaintyCoefficient *
        effectiveAccuracy *
        Math.sqrt(Math.max(1, measured.polylinePointCount)),
    ),
  );

  // --- Behaviour metrics (kept samples, Doppler speeds preferred). ----------
  const behaviourSpeeds: { dtSeconds: number; speedMps: number }[] = [];
  for (let index = 1; index < kept.length; index += 1) {
    const a = kept[index - 1]!;
    const b = kept[index]!;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) {
      continue;
    }
    const derived = haversineMeters(a.lat, a.lon, b.lat, b.lon) / dt;
    const speed = a.spd !== null && b.spd !== null ? (a.spd + b.spd) / 2 : derived;
    behaviourSpeeds.push({ dtSeconds: dt, speedMps: speed });
  }

  const averageSpeed =
    keptElapsedSeconds > 0 ? computedDistance / keptElapsedSeconds : null;

  // Fastest sustained speed over the rolling window, from credited distance.
  let maxSustained: number | null = null;
  for (let right = 1; right < measured.timesMs.length; right += 1) {
    for (let probe = right - 1; probe >= 0; probe -= 1) {
      const spanSeconds = (measured.timesMs[right]! - measured.timesMs[probe]!) / 1000;
      if (spanSeconds >= rules.sustainedWindowSeconds) {
        const speed =
          (measured.cumulativeMeters[right]! - measured.cumulativeMeters[probe]!) /
          spanSeconds;
        if (maxSustained === null || speed > maxSustained) {
          maxSustained = speed;
        }
        break;
      }
    }
  }

  let stationaryPeriods = 0;
  let stationarySeconds = 0;
  let currentStationary = 0;
  for (const segment of behaviourSpeeds) {
    if (segment.speedMps < rules.stationarySpeedMps) {
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
  for (let index = 1; index < behaviourSpeeds.length; index += 1) {
    const deltaV = Math.abs(
      behaviourSpeeds[index]!.speedMps - behaviourSpeeds[index - 1]!.speedMps,
    );
    const dt = behaviourSpeeds[index]!.dtSeconds;
    if (dt > 0 && deltaV / dt > rules.accelerationSpikeMps2) {
      accelerationSpikes += 1;
    }
  }
  const spikeRatio =
    behaviourSpeeds.length > 0 ? accelerationSpikes / behaviourSpeeds.length : 0;

  const quarterSplits =
    computedDistance >= requiredDistanceMeters
      ? [0.25, 0.5, 0.75, 1].map(
          (fraction) =>
            elapsedAtDistance(
              measured.timesMs,
              measured.cumulativeMeters,
              requiredDistanceMeters * fraction,
            ) ?? 0,
        )
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
  const qualityPass =
    signalQuality >= rules.minSignalQualityConfidence &&
    coverage >= rules.minCoverage;
  const clearsWithMargin =
    computedDistance >= requiredDistanceMeters + distanceUncertainty;
  const shortBeyondMargin =
    computedDistance <
    requiredDistanceMeters * (1 - rules.distanceShortfallTolerance) -
      distanceUncertainty;

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
    if (qualityPass) {
      verdict = 'failed';
      reasonCodes.push('impossible_speed');
    } else {
      verdict = 'unable_to_verify';
      reasonCodes.push('impossible_speed_low_quality');
    }
  } else if (shortBeyondMargin) {
    // Short of the protocol distance by more than the measurement could
    // plausibly miss. Positive finding only on a trustworthy trace.
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
  } else if (!clearsWithMargin) {
    // A trustworthy trace whose crossing sits inside the uncertainty band:
    // the measurement cannot confidently establish the performance either
    // way. The candidate guidance is simply to run a little past the line.
    verdict = 'unable_to_verify';
    reasonCodes.push('distance_margin_uncertain');
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
      ? elapsedAtDistance(measured.timesMs, measured.cumulativeMeters, requiredDistanceMeters)
      : null;

  // Uncertainty in time = distance uncertainty at the pace being run at the
  // crossing (approximated by the run's average credited speed).
  const acceptedTimeUncertainty =
    acceptedTime !== null && averageSpeed !== null && averageSpeed > 0
      ? distanceUncertainty / averageSpeed
      : null;

  return {
    ...base,
    verdict,
    reasonCodes,
    anomalies,
    rawDistanceMeters: Math.round(rawDistance * 10) / 10,
    computedDistanceMeters: Math.round(computedDistance * 10) / 10,
    acceptedTimeSeconds: acceptedTime === null ? null : Math.round(acceptedTime * 10) / 10,
    distanceUncertaintyMeters: Math.round(distanceUncertainty * 10) / 10,
    acceptedTimeUncertaintySeconds:
      acceptedTimeUncertainty === null ? null : Math.round(acceptedTimeUncertainty * 10) / 10,
    elapsedSeconds: Math.round(elapsedSeconds * 10) / 10,
    routeFingerprint: fingerprintRoute(kept),
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
