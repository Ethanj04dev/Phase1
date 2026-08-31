import type { RunSample, RunTrace, RunTraceEvent } from './types';

/**
 * Synthetic trace builders for the Run Engine test suite.
 *
 * Traces run north along a meridian, positions integrated from a speed
 * profile at 1 Hz. Deterministic by construction — the "random" jitter uses
 * a fixed linear congruential generator, so every test sees the same trace
 * every run.
 */

const METERS_PER_DEGREE_LAT = 111_320;
export const T0 = 1_756_500_000_000; // fixed epoch base for every trace

/** Deterministic pseudo-random in [0, 1). */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

export interface TraceOptions {
  durationSeconds: number;
  /** Speed in m/s at second `t`. */
  speedAt: (t: number) => number;
  intervalSeconds?: number;
  accuracyAt?: (t: number) => number;
  /** Position jitter amplitude (std-ish) in metres. */
  jitterMeters?: number;
  /**
   * 'white': independent per-sample noise — the pessimistic worst case.
   * 'ar1': first-order autocorrelated noise (ρ≈0.9), which is how real GPS
   * error actually behaves — it drifts, it does not shake.
   */
  jitterModel?: 'white' | 'ar1';
  jitterSeed?: number;
  startTimeMs?: number;
  events?: readonly RunTraceEvent[];
  /** Drop the sample at these second-offsets (simulating loss). */
  dropSeconds?: ReadonlySet<number>;
}

/** A synthetic trace with its analytically known true path length. */
export interface TruthTrace {
  trace: RunTrace;
  referenceMeters: number;
  /** True elapsed seconds at which the runner crossed `atMeters`. */
  referenceCrossingSeconds: (atMeters: number) => number | null;
}

export function makeTruthTrace(options: TraceOptions): TruthTrace {
  const {
    durationSeconds,
    speedAt,
    intervalSeconds = 1,
    accuracyAt = () => 8,
    jitterMeters = 0,
    jitterModel = 'white',
    jitterSeed = 42,
    startTimeMs = T0,
    events = [],
    dropSeconds = new Set<number>(),
  } = options;

  const random = lcg(jitterSeed);
  const rho = 0.9;
  const innovationScale = jitterModel === 'ar1' ? Math.sqrt(1 - rho * rho) : 1;
  let jLat = 0;
  let jLon = 0;

  const samples: RunSample[] = [];
  const truthBySecond: number[] = [0];
  let northMeters = 0;

  for (let second = 0; second <= durationSeconds; second += intervalSeconds) {
    if (second > 0) {
      northMeters += speedAt(second) * intervalSeconds;
      truthBySecond.push(northMeters);
    }
    const noiseLat = (random() * 2 - 1) * jitterMeters * innovationScale;
    const noiseLon = (random() * 2 - 1) * jitterMeters * innovationScale;
    if (jitterModel === 'ar1') {
      jLat = rho * jLat + noiseLat;
      jLon = rho * jLon + noiseLon;
    } else {
      jLat = noiseLat;
      jLon = noiseLon;
    }
    if (dropSeconds.has(second)) {
      continue;
    }
    samples.push({
      t: startTimeMs + second * 1000,
      lat: 30 + (northMeters + jLat) / METERS_PER_DEGREE_LAT,
      // Longitude degrees scaled at this latitude (~cos 30° ≈ 0.866).
      lon: -85 + jLon / (METERS_PER_DEGREE_LAT * 0.866),
      acc: accuracyAt(second),
      alt: null,
      spd: speedAt(second),
    });
  }

  return {
    trace: { formatVersion: 1, samples, events },
    referenceMeters: northMeters,
    referenceCrossingSeconds: (atMeters: number) => {
      for (let second = 1; second < truthBySecond.length; second += 1) {
        if (truthBySecond[second]! >= atMeters) {
          const previous = truthBySecond[second - 1]!;
          const span = truthBySecond[second]! - previous;
          const fraction = span <= 0 ? 1 : (atMeters - previous) / span;
          return (second - 1 + fraction) * intervalSeconds;
        }
      }
      return null;
    },
  };
}

export function makeTrace(options: TraceOptions): RunTrace {
  return makeTruthTrace(options).trace;
}

/** A trace that follows a repeated rectangular loop (track laps, turns). */
export function makeLoopTrace(options: {
  durationSeconds: number;
  speedMps: number;
  /** Loop side lengths in metres (a lap is 2 × (a + b)). */
  sideA: number;
  sideB: number;
}): RunTrace {
  const { durationSeconds, speedMps, sideA, sideB } = options;
  const samples: RunSample[] = [];
  let north = 0;
  let east = 0;
  let traveled = 0;
  const lap = 2 * (sideA + sideB);

  for (let second = 0; second <= durationSeconds; second += 1) {
    if (second > 0) {
      const step = speedMps;
      const position = traveled % lap;
      if (position < sideA) {
        north += step;
      } else if (position < sideA + sideB) {
        east += step;
      } else if (position < sideA * 2 + sideB) {
        north -= step;
      } else {
        east -= step;
      }
      traveled += step;
    }
    samples.push({
      t: T0 + second * 1000,
      lat: 30 + north / METERS_PER_DEGREE_LAT,
      lon: -85 + east / (METERS_PER_DEGREE_LAT * Math.cos((30 * Math.PI) / 180)),
      acc: 8,
      alt: null,
      spd: speedMps,
    });
  }

  return { formatVersion: 1, samples, events: [] };
}

/**
 * Applies positional jitter to an existing trace. The true path length of
 * the input is unchanged — this perturbs the *measurements*, which is
 * exactly what GPS error does.
 */
export function addJitter(
  trace: RunTrace,
  jitterMeters: number,
  model: 'white' | 'ar1',
  seed: number,
): RunTrace {
  const random = lcg(seed);
  const rho = 0.9;
  const innovationScale = model === 'ar1' ? Math.sqrt(1 - rho * rho) : 1;
  let jLat = 0;
  let jLon = 0;
  return {
    ...trace,
    samples: trace.samples.map((sample) => {
      const noiseLat = (random() * 2 - 1) * jitterMeters * innovationScale;
      const noiseLon = (random() * 2 - 1) * jitterMeters * innovationScale;
      if (model === 'ar1') {
        jLat = rho * jLat + noiseLat;
        jLon = rho * jLon + noiseLon;
      } else {
        jLat = noiseLat;
        jLon = noiseLon;
      }
      return {
        ...sample,
        lat: sample.lat + jLat / METERS_PER_DEGREE_LAT,
        lon: sample.lon + jLon / (METERS_PER_DEGREE_LAT * Math.cos((30 * Math.PI) / 180)),
      };
    }),
  };
}

/** An out-and-back: north for half the time, back south for the rest. */
export function makeOutAndBackTrace(durationSeconds: number, speedMps: number): RunTrace {
  const samples: RunSample[] = [];
  let north = 0;
  for (let second = 0; second <= durationSeconds; second += 1) {
    if (second > 0) {
      north += second <= durationSeconds / 2 ? speedMps : -speedMps;
    }
    samples.push({
      t: T0 + second * 1000,
      lat: 30 + north / METERS_PER_DEGREE_LAT,
      lon: -85,
      acc: 8,
      alt: null,
      spd: speedMps,
    });
  }
  return { formatVersion: 1, samples, events: [] };
}
