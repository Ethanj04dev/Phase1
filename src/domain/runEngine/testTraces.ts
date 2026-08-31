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
  /** Uniform position jitter amplitude in metres. */
  jitterMeters?: number;
  jitterSeed?: number;
  startTimeMs?: number;
  events?: readonly RunTraceEvent[];
  /** Drop the sample at these second-offsets (simulating loss). */
  dropSeconds?: ReadonlySet<number>;
}

export function makeTrace(options: TraceOptions): RunTrace {
  const {
    durationSeconds,
    speedAt,
    intervalSeconds = 1,
    accuracyAt = () => 8,
    jitterMeters = 0,
    jitterSeed = 42,
    startTimeMs = T0,
    events = [],
    dropSeconds = new Set<number>(),
  } = options;

  const random = lcg(jitterSeed);
  const samples: RunSample[] = [];
  let northMeters = 0;

  for (let second = 0; second <= durationSeconds; second += intervalSeconds) {
    if (second > 0) {
      northMeters += speedAt(second) * intervalSeconds;
    }
    if (dropSeconds.has(second)) {
      continue;
    }
    const jitterLat = jitterMeters === 0 ? 0 : (random() * 2 - 1) * jitterMeters;
    const jitterLon = jitterMeters === 0 ? 0 : (random() * 2 - 1) * jitterMeters;
    samples.push({
      t: startTimeMs + second * 1000,
      lat: 30 + (northMeters + jitterLat) / METERS_PER_DEGREE_LAT,
      // Longitude degrees scaled at this latitude (~cos 30° ≈ 0.866).
      lon: -85 + jitterLon / (METERS_PER_DEGREE_LAT * 0.866),
      acc: accuracyAt(second),
      alt: null,
      spd: speedAt(second),
    });
  }

  return { formatVersion: 1, samples, events };
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
