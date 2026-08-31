import { analyzeRun } from './analyze';
import { haversineMeters } from './geo';
import { RUN_RULESET } from './ruleset';
import { makeLoopTrace, makeOutAndBackTrace, makeTrace, T0 } from './testTraces';
import type { RunTrace } from './types';

/**
 * The Run Engine adversarial suite. Every case documents which verdict the
 * ruleset owes it, and why. These tests are the engine's release gate: a
 * ruleset change that flips one of these is a decision, not a drift.
 */

const MILE_1_5 = 2414.016;

function analyze(trace: RunTrace, requiredDistanceMeters = MILE_1_5, windowed = true) {
  return analyzeRun({
    trace,
    requiredDistanceMeters,
    sessionWindow: windowed
      ? { openedAtMs: T0 - 10_000, closedAtMs: T0 + 3_600_000 }
      : undefined,
  });
}

describe('geo', () => {
  it('haversine matches a known distance', () => {
    // One degree of latitude ≈ 111.2 km.
    const d = haversineMeters(30, -85, 31, -85);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });
});

describe('valid runs', () => {
  it('verifies a normal 1.5-mile run and interpolates the accepted time', () => {
    // 3.6 m/s for 690s = 2484m: over-distance. Accepted time must be the
    // crossing of exactly 2414.016m (≈ 670.6s), NOT the total elapsed 690s.
    const analysis = analyze(makeTrace({ durationSeconds: 690, speedAt: () => 3.6 }));
    expect(analysis.verdict).toBe('verified');
    expect(analysis.computedDistanceMeters).toBeGreaterThanOrEqual(MILE_1_5);
    expect(analysis.acceptedTimeSeconds).toBeGreaterThan(668);
    expect(analysis.acceptedTimeSeconds).toBeLessThan(673);
    expect(analysis.acceptedTimeSeconds!).toBeLessThan(analysis.elapsedSeconds);
    expect(analysis.pace.quarterSplitsSeconds).toHaveLength(4);
  });

  it('verifies a slow but honest runner', () => {
    // 2.0 m/s → ~20 minutes, running a little past the line as instructed.
    const analysis = analyze(makeTrace({ durationSeconds: 1290, speedAt: () => 2.0 }));
    expect(analysis.verdict).toBe('verified');
    expect(analysis.acceptedTimeSeconds).toBeGreaterThan(1195);
    expect(analysis.acceptedTimeSeconds).toBeLessThan(1215);
  });

  it('abstains when the crossing sits inside the uncertainty band', () => {
    // ~2436m computed vs 2414m required: a good trace that clears by less
    // than the measurement uncertainty, so the engine refuses to guess.
    const analysis = analyze(makeTrace({ durationSeconds: 1218, speedAt: () => 2.0 }));
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('distance_margin_uncertain');
  });

  it('verifies an extremely fast but humanly possible runner', () => {
    // 6.7 m/s sustained (~6:00 for 1.5mi) — beyond elite, below the
    // impossible bound. A fast athlete must never fail for being fast.
    const analysis = analyze(makeTrace({ durationSeconds: 370, speedAt: () => 6.7 }));
    expect(analysis.verdict).toBe('verified');
    expect(analysis.reasonCodes).toHaveLength(0);
  });

  it('tolerates realistic GPS noise', () => {
    const analysis = analyze(
      makeTrace({ durationSeconds: 700, speedAt: () => 3.6, jitterMeters: 4 }),
    );
    expect(analysis.verdict).toBe('verified');
    // Smoothing bounds jitter inflation. White noise this hostile still
    // inflates somewhat — a known limitation, held under 12% by the filter.
    expect(analysis.computedDistanceMeters).toBeLessThan(2520 * 1.12);
  });

  it('verifies a brief mid-run stop and reports it as a signal, not an offence', () => {
    const analysis = analyze(
      makeTrace({
        durationSeconds: 730,
        speedAt: (t) => (t > 300 && t <= 330 ? 0 : 3.6),
      }),
    );
    expect(analysis.verdict).toBe('verified');
    expect(analysis.pace.stationaryPeriodCount).toBe(1);
    expect(analysis.anomalies.some((a) => a.code === 'stationary_periods')).toBe(true);
  });

  it('survives a short GPS dropout', () => {
    const dropped = new Set<number>();
    for (let second = 300; second < 318; second += 1) {
      dropped.add(second);
    }
    const analysis = analyze(
      makeTrace({ durationSeconds: 700, speedAt: () => 3.6, dropSeconds: dropped }),
    );
    expect(analysis.verdict).toBe('verified');
    expect(analysis.quality.gapCount).toBeGreaterThan(0);
  });

  it('handles a route with many turns (track laps)', () => {
    // 400m rectangular "track", ~6.2 laps of honest running.
    const analysis = analyze(
      makeLoopTrace({ durationSeconds: 700, speedMps: 3.6, sideA: 100, sideB: 100 }),
    );
    expect(analysis.verdict).toBe('verified');
    expect(analysis.computedDistanceMeters).toBeGreaterThan(MILE_1_5);
  });

  it('handles an out-and-back route', () => {
    const analysis = analyze(makeOutAndBackTrace(700, 3.6));
    expect(analysis.verdict).toBe('verified');
    expect(analysis.computedDistanceMeters).toBeGreaterThan(MILE_1_5);
  });

  it('supports other protocol distances without special cases', () => {
    // The engine takes the requirement from the protocol: a 1-mile event.
    const analysis = analyze(
      makeTrace({ durationSeconds: 480, speedAt: () => 3.6 }),
      1609.344,
    );
    expect(analysis.verdict).toBe('verified');
    expect(analysis.acceptedTimeSeconds).toBeGreaterThan(444);
    expect(analysis.acceptedTimeSeconds).toBeLessThan(450);
  });
});

describe('failures — positive evidence of invalidity', () => {
  it('fails a clean trace that is short of the required distance', () => {
    // 1.2 miles of good-quality evidence: the shortfall is real.
    const analysis = analyze(makeTrace({ durationSeconds: 540, speedAt: () => 3.6 }));
    expect(analysis.verdict).toBe('failed');
    expect(analysis.reasonCodes).toContain('insufficient_distance');
    expect(analysis.acceptedTimeSeconds).toBeNull();
  });

  it('fails sustained vehicle-speed movement on a clean signal', () => {
    // 12 m/s sustained for the whole "run" — no human runs 43 km/h.
    const analysis = analyze(makeTrace({ durationSeconds: 300, speedAt: () => 12 }));
    expect(analysis.verdict).toBe('failed');
    expect(analysis.reasonCodes).toContain('impossible_speed');
    expect(
      analysis.anomalies.some((a) => a.code === 'sustained_speed_beyond_human_record'),
    ).toBe(true);
  });
});

describe('abstentions — ambiguity is unable_to_verify, never a guess', () => {
  it('abstains on a trace whose samples are all poor accuracy', () => {
    const analysis = analyze(
      makeTrace({ durationSeconds: 700, speedAt: () => 3.6, accuracyAt: () => 45 }),
    );
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.quality.droppedSampleCount).toBeGreaterThan(600);
  });

  it('abstains on mediocre accuracy rather than trusting the distance', () => {
    const analysis = analyze(
      makeTrace({ durationSeconds: 700, speedAt: () => 3.6, accuracyAt: () => 28 }),
    );
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('poor_gps_accuracy');
  });

  it('abstains when a prolonged dropout hides too much of the run', () => {
    const dropped = new Set<number>();
    for (let second = 200; second < 320; second += 1) {
      dropped.add(second);
    }
    const analysis = analyze(
      makeTrace({ durationSeconds: 700, speedAt: () => 3.6, dropSeconds: dropped }),
    );
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('sampling_gaps');
  });

  it('excludes teleport jumps from distance and abstains when they were needed', () => {
    // Honest movement covers only ~1.1 miles; a 700m teleport "finishes" it.
    const trace = makeTrace({ durationSeconds: 700, speedAt: () => 2.6 });
    const samples = [...trace.samples];
    const jumpIndex = 350;
    const jumped = samples.map((sample, index) =>
      index >= jumpIndex ? { ...sample, lat: sample.lat + 700 / 111_320 } : sample,
    );
    const analysis = analyze({ ...trace, samples: jumped });
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.anomalies.some((a) => a.code === 'teleport_segments')).toBe(true);
    expect(analysis.computedDistanceMeters).toBeLessThan(MILE_1_5);
  });

  it('discards a single displaced point as a glitch and still verifies', () => {
    const trace = makeTrace({ durationSeconds: 720, speedAt: () => 3.6 });
    const samples = trace.samples.map((sample, index) =>
      index === 400 ? { ...sample, lat: sample.lat + 300 / 111_320 } : sample,
    );
    const analysis = analyze({ ...trace, samples });
    expect(analysis.verdict).toBe('verified');
    expect(analysis.anomalies.some((a) => a.code === 'gps_outliers_removed')).toBe(true);
  });

  it('abstains on vehicle-suspect speed below the impossible bound', () => {
    // 8 m/s sustained: beyond the mile record, below vehicle certainty.
    const analysis = analyze(makeTrace({ durationSeconds: 320, speedAt: () => 8 }));
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('implausible_movement');
  });

  it('abstains on repeated impossible acceleration swings', () => {
    // 0.5 ↔ 9.5 m/s in three-second blocks: every block boundary is a
    // >4 m/s² swing no runner produces, over and over.
    const analysis = analyze(
      makeTrace({ durationSeconds: 700, speedAt: (t) => (t % 6 < 3 ? 0.5 : 9.5) }),
    );
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.anomalies.some((a) => a.code === 'acceleration_spikes')).toBe(true);
  });

  it('abstains when timestamps run backwards (manipulation attempt)', () => {
    const trace = makeTrace({ durationSeconds: 700, speedAt: () => 3.6 });
    const samples = trace.samples.map((sample, index) =>
      index > 100 && index < 110 ? { ...sample, t: sample.t - 60_000 } : sample,
    );
    const analysis = analyze({ ...trace, samples });
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('timestamp_anomaly');
  });

  it('abstains on a replayed trace recorded outside the session window', () => {
    // The trace itself is a perfect run — recorded an hour before the event
    // window opened. Session binding catches the replay.
    const analysis = analyzeRun({
      trace: makeTrace({ durationSeconds: 690, speedAt: () => 3.6 }),
      requiredDistanceMeters: MILE_1_5,
      sessionWindow: { openedAtMs: T0 + 3_600_000, closedAtMs: T0 + 7_200_000 },
    });
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('outside_session_window');
  });

  it('abstains when the app was backgrounded during tracking', () => {
    const analysis = analyze(
      makeTrace({
        durationSeconds: 700,
        speedAt: () => 3.6,
        events: [
          { t: T0 + 200_000, type: 'app_background' },
          { t: T0 + 230_000, type: 'app_foreground' },
        ],
      }),
    );
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('continuity_interrupted');
  });

  it('abstains on insufficient data instead of judging a stub trace', () => {
    const analysis = analyze(makeTrace({ durationSeconds: 30, speedAt: () => 3.6 }));
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toEqual(['insufficient_data']);
  });

  it('reaches a verdict on degraded urban signal without crashing', () => {
    // Mixed accuracy 10–35m, jitter, scattered dropouts: the engine must
    // produce a structured, reasoned outcome — never a guess, never a throw.
    const dropped = new Set<number>([50, 51, 120, 121, 122, 400, 401, 555]);
    const analysis = analyze(
      makeTrace({
        durationSeconds: 720,
        speedAt: () => 3.6,
        accuracyAt: (t) => 10 + ((t * 7) % 26),
        jitterMeters: 8,
        jitterSeed: 7,
        dropSeconds: dropped,
      }),
    );
    expect(['verified', 'unable_to_verify']).toContain(analysis.verdict);
    if (analysis.verdict === 'unable_to_verify') {
      expect(analysis.reasonCodes.length).toBeGreaterThan(0);
    }
    expect(analysis.quality.medianAccuracyMeters).not.toBeNull();
  });
});

describe('structured output', () => {
  it('always stamps engine and ruleset versions', () => {
    const analysis = analyze(makeTrace({ durationSeconds: 690, speedAt: () => 3.6 }));
    expect(analysis.engine).toBe('run_gps');
    expect(analysis.engineVersion).toBe('2');
    expect(analysis.rulesetVersion).toBe(2);
  });

  it('reports raw distance beside computed distance, never instead of it', () => {
    const trace = makeTrace({ durationSeconds: 690, speedAt: () => 3.6, jitterMeters: 6 });
    const analysis = analyze(trace);
    expect(analysis.rawDistanceMeters).toBeGreaterThan(0);
    expect(analysis.computedDistanceMeters).toBeGreaterThan(0);
    // Raw includes jitter the filter suppresses; they may differ.
    expect(analysis.rawDistanceMeters).not.toBe(analysis.computedDistanceMeters);
  });

  it('never verifies below every confidence threshold', () => {
    const verified = analyze(makeTrace({ durationSeconds: 690, speedAt: () => 3.6 }));
    expect(verified.confidences.signalQuality).toBeGreaterThanOrEqual(
      RUN_RULESET.minSignalQualityConfidence,
    );
    expect(verified.confidences.continuity).toBeGreaterThanOrEqual(
      RUN_RULESET.minContinuityConfidence,
    );
    expect(verified.confidences.plausibility).toBeGreaterThanOrEqual(
      RUN_RULESET.minPlausibilityConfidence,
    );
  });
});
