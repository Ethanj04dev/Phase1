import { haversineMeters } from './geo';
import type { RUN_RULESET } from './ruleset';
import type { RunSample } from './types';

/**
 * Trace preparation and the candidate distance pipelines.
 *
 * Everything here is deterministic. The pipelines exist side by side so the
 * benchmark can measure them against known reference distances and the
 * ruleset can select one by evidence rather than taste. Whatever is
 * selected, the raw trace is never touched — these are measurement views.
 *
 * The systematic enemy is noise inflation: GPS error adds length to every
 * segment, and summed over a run it only ever adds. Two counters exist:
 * estimating position (Kalman-class state estimation) and measuring over
 * longer strides so per-segment noise is amortised across more true
 * distance. Both cut corners slightly on curved routes — an under-credit,
 * which is the conservative direction for a ranking product.
 */

type Rules = typeof RUN_RULESET;

export interface PreparedTrace {
  kept: RunSample[];
  dropped: number;
  nonMonotonic: number;
  outliersRemoved: number;
}

/** Accuracy filter, clock-order filter, single-point outlier rejection. */
export function prepareSamples(raw: readonly RunSample[], rules: Rules): PreparedTrace {
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

  // A sample the trace teleports INTO and straight back OUT of is a
  // positioning glitch, not two suspicious jumps.
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
    const inSpeed =
      haversineMeters(previous.lat, previous.lon, candidate.lat, candidate.lon) / inDt;
    const outSpeed =
      haversineMeters(candidate.lat, candidate.lon, next.lat, next.lon) / outDt;
    if (inSpeed > rules.teleportSpeedMps && outSpeed > rules.teleportSpeedMps) {
      kept.splice(index, 1);
      outliersRemoved += 1;
      dropped += 1;
    }
  }

  return { kept, dropped, nonMonotonic, outliersRemoved };
}

/**
 * Splits the kept samples into contiguous blocks at genuine teleports, so no
 * pipeline — least of all a state estimator that would otherwise be dragged
 * through space — can ever credit distance across a positioning jump.
 */
export function splitAtTeleports(
  kept: readonly RunSample[],
  rules: Rules,
): { blocks: RunSample[][]; teleports: number } {
  const blocks: RunSample[][] = [];
  let current: RunSample[] = [];
  let teleports = 0;

  for (const sample of kept) {
    const previous = current[current.length - 1];
    if (previous) {
      const dt = (sample.t - previous.t) / 1000;
      const speed =
        dt > 0 ? haversineMeters(previous.lat, previous.lon, sample.lat, sample.lon) / dt : 0;
      if (speed > rules.teleportSpeedMps) {
        teleports += 1;
        if (current.length > 1) {
          blocks.push(current);
        }
        current = [sample];
        continue;
      }
    }
    current.push(sample);
  }
  if (current.length > 1) {
    blocks.push(current);
  }
  return { blocks, teleports };
}

/** A point on the measurement polyline, in local metres. */
interface PathPoint {
  t: number;
  x: number;
  y: number;
}

function toLocalMeters(samples: readonly RunSample[]): PathPoint[] {
  if (samples.length === 0) {
    return [];
  }
  const lat0 = samples[0]!.lat;
  const lon0 = samples[0]!.lon;
  const metersPerLat = 111_320;
  const metersPerLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return samples.map((sample) => ({
    t: sample.t,
    x: (sample.lon - lon0) * metersPerLon,
    y: (sample.lat - lat0) * metersPerLat,
  }));
}

function polylineLength(points: readonly PathPoint[], jitterFloorSpeedMps: number): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) {
      continue;
    }
    const meters = Math.hypot(b.x - a.x, b.y - a.y);
    if (meters / dt >= jitterFloorSpeedMps) {
      total += meters;
    }
  }
  return total;
}

/** Emit polyline points at least `strideSeconds` apart (first/last always). */
function resampleByStride(points: readonly PathPoint[], strideSeconds: number): PathPoint[] {
  if (points.length <= 2) {
    return [...points];
  }
  const out: PathPoint[] = [points[0]!];
  for (let index = 1; index < points.length - 1; index += 1) {
    if ((points[index]!.t - out[out.length - 1]!.t) / 1000 >= strideSeconds) {
      out.push(points[index]!);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * Distance-based resampling: emit a point once roughly `minMeters` of raw
 * movement has accumulated (or `maxSeconds` has passed, so stationary spells
 * cannot stall the polyline). Slow and fast runners get the same
 * signal-to-noise per measured segment, which time-based strides do not give.
 */
function resampleByDistance(
  points: readonly PathPoint[],
  minMeters: number,
  maxSeconds: number,
): PathPoint[] {
  if (points.length <= 2) {
    return [...points];
  }
  const out: PathPoint[] = [points[0]!];
  let accumulated = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    accumulated += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.y - points[index - 1]!.y,
    );
    const dtSeconds = (points[index]!.t - out[out.length - 1]!.t) / 1000;
    if (accumulated >= minMeters || dtSeconds >= maxSeconds) {
      out.push(points[index]!);
      accumulated = 0;
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Gap-aware centred 3-point smoothing (the v1 pipeline, kept comparable). */
function smooth3(points: readonly PathPoint[], nominalIntervalSeconds: number): PathPoint[] {
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return point;
    }
    const previous = points[index - 1]!;
    const next = points[index + 1]!;
    const beforeGap = (point.t - previous.t) / 1000 > nominalIntervalSeconds;
    const afterGap = (next.t - point.t) / 1000 > nominalIntervalSeconds;
    if (beforeGap || afterGap) {
      return point;
    }
    return {
      t: point.t,
      x: (previous.x + point.x + next.x) / 3,
      y: (previous.y + point.y + next.y) / 3,
    };
  });
}

/**
 * Per-axis constant-velocity Kalman filter. Measurement noise comes from the
 * sample's own reported accuracy; the filter re-initialises across sampling
 * gaps rather than coasting blind through them.
 */
function kalmanFilter(
  points: readonly PathPoint[],
  accuracies: readonly (number | null)[],
  rules: Rules,
): PathPoint[] {
  if (points.length === 0) {
    return [];
  }
  const q = rules.kalmanProcessNoise; // acceleration variance, (m/s²)²

  // State per axis: [position, velocity] with covariance [[p00,p01],[p01,p11]].
  const state = {
    x: { p: points[0]!.x, v: 0, p00: 25, p01: 0, p11: 25 },
    y: { p: points[0]!.y, v: 0, p00: 25, p01: 0, p11: 25 },
  };
  const out: PathPoint[] = [{ ...points[0]! }];

  for (let index = 1; index < points.length; index += 1) {
    const dt = (points[index]!.t - points[index - 1]!.t) / 1000;
    const accuracy = accuracies[index];
    const r = Math.max(accuracy ?? 10, 4) ** 2;

    if (dt > rules.maxGapSeconds) {
      // Do not coast across a gap; restart at the measurement.
      state.x = { p: points[index]!.x, v: 0, p00: r, p01: 0, p11: 25 };
      state.y = { p: points[index]!.y, v: 0, p00: r, p01: 0, p11: 25 };
      out.push({ ...points[index]! });
      continue;
    }

    for (const axis of ['x', 'y'] as const) {
      const s = state[axis];
      const measurement = points[index]![axis];
      // Predict.
      const p = s.p + s.v * dt;
      const p00 = s.p00 + 2 * s.p01 * dt + s.p11 * dt * dt + (q * dt ** 4) / 4;
      const p01 = s.p01 + s.p11 * dt + (q * dt ** 3) / 2;
      const p11 = s.p11 + q * dt * dt;
      // Update.
      const k0 = p00 / (p00 + r);
      const k1 = p01 / (p00 + r);
      const innovation = measurement - p;
      s.p = p + k0 * innovation;
      s.v += k1 * innovation;
      s.p00 = (1 - k0) * p00;
      s.p01 = (1 - k0) * p01;
      s.p11 = p11 - k1 * p01;
    }
    out.push({ t: points[index]!.t, x: state.x.p, y: state.y.p });
  }
  return out;
}

export type DistancePipelineId = 'smooth3' | 'stride' | 'kalman' | 'kalman_stride';

export interface MeasuredPath {
  /** Absolute ms timestamps of the measurement polyline. */
  timesMs: number[];
  /** Credited cumulative metres at each polyline point. */
  cumulativeMeters: number[];
  computedMeters: number;
  teleports: number;
  /** Points on the final measurement polyline (for uncertainty scaling). */
  polylinePointCount: number;
}

/** Measures credited distance over the kept samples with one pipeline. */
export function measurePath(
  kept: readonly RunSample[],
  pipeline: DistancePipelineId,
  rules: Rules,
): MeasuredPath {
  const { blocks, teleports } = splitAtTeleports(kept, rules);

  const timesMs: number[] = [];
  const cumulativeMeters: number[] = [];
  let total = 0;
  let polylinePointCount = 0;

  for (const block of blocks) {
    const local = toLocalMeters(block);
    const accuracies = block.map((sample) => sample.acc);

    let polyline: PathPoint[];
    switch (pipeline) {
      case 'smooth3':
        polyline = smooth3(local, rules.nominalIntervalSeconds);
        break;
      case 'stride':
        polyline = resampleByStride(local, rules.strideSeconds);
        break;
      case 'kalman':
        polyline = kalmanFilter(local, accuracies, rules);
        break;
      case 'kalman_stride':
        polyline = resampleByDistance(
          kalmanFilter(local, accuracies, rules),
          rules.strideMinMeters,
          rules.strideMaxSeconds,
        );
        break;
    }

    polylinePointCount += polyline.length;
    for (let index = 0; index < polyline.length; index += 1) {
      if (index > 0) {
        const a = polyline[index - 1]!;
        const b = polyline[index]!;
        const dt = (b.t - a.t) / 1000;
        const meters = Math.hypot(b.x - a.x, b.y - a.y);
        const credited = dt > 0 && meters / dt >= rules.jitterFloorSpeedMps ? meters : 0;
        total += credited;
      }
      timesMs.push(polyline[index]!.t);
      cumulativeMeters.push(total);
    }
  }

  return {
    timesMs,
    cumulativeMeters,
    computedMeters: total,
    teleports,
    polylinePointCount,
  };
}

export { polylineLength };
