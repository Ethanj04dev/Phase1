import { analyzeRun } from './analyze';
import { RUN_ENGINE_VERSION, RUN_RULESET_VERSION } from './ruleset';
import { addJitter, makeLoopTrace, makeTrace, makeTruthTrace, T0 } from './testTraces';
import type { RunAnalysisInput, RunTrace } from './types';

/**
 * Properties that must hold for every trace the engine will ever see —
 * invariants, not scenarios. A change that breaks one of these is not a
 * tuning decision; it is a defect.
 */

const MILE_1_5 = 2414.016;
const WINDOW = { openedAtMs: T0 - 10_000, closedAtMs: T0 + 3_600_000 };

/** A spread of traces: clean, noisy, gappy, twisty, short, hostile. */
function corpus(): { name: string; input: RunAnalysisInput }[] {
  const dropped = new Set<number>();
  for (let second = 200; second < 260; second += 1) {
    dropped.add(second);
  }
  const teleported: RunTrace = (() => {
    const trace = makeTrace({ durationSeconds: 700, speedAt: () => 2.6 });
    const samples = trace.samples.map((sample, index) =>
      index >= 350 ? { ...sample, lat: sample.lat + 700 / 111_320 } : sample,
    );
    return { ...trace, samples };
  })();

  return [
    { name: 'clean', input: { trace: makeTrace({ durationSeconds: 700, speedAt: () => 3.6 }), requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'noisy', input: { trace: makeTrace({ durationSeconds: 710, speedAt: () => 3.6, jitterMeters: 5, jitterModel: 'ar1', jitterSeed: 9 }), requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'white_noise', input: { trace: makeTrace({ durationSeconds: 700, speedAt: () => 3.6, jitterMeters: 4, jitterModel: 'white' }), requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'gappy', input: { trace: makeTrace({ durationSeconds: 720, speedAt: () => 3.6, dropSeconds: dropped }), requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'twisty', input: { trace: addJitter(makeLoopTrace({ durationSeconds: 700, speedMps: 3.6, sideA: 40, sideB: 30 }), 3, 'ar1', 5), requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'short', input: { trace: makeTrace({ durationSeconds: 500, speedAt: () => 3.6 }), requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'teleported', input: { trace: teleported, requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'stub', input: { trace: makeTrace({ durationSeconds: 20, speedAt: () => 3.6 }), requiredDistanceMeters: MILE_1_5, sessionWindow: WINDOW } },
    { name: 'one_mile', input: { trace: makeTrace({ durationSeconds: 480, speedAt: () => 3.6 }), requiredDistanceMeters: 1609.344, sessionWindow: WINDOW } },
  ];
}

describe('run engine invariants', () => {
  it.each(corpus())('$name: processing twice produces identical output', ({ input }) => {
    const first = analyzeRun(input);
    const second = analyzeRun(input);
    expect(second).toEqual(first);
  });

  it.each(corpus())('$name: the raw trace is never mutated', ({ input }) => {
    const before = JSON.stringify(input.trace);
    analyzeRun(input);
    expect(JSON.stringify(input.trace)).toBe(before);
  });

  it.each(corpus())(
    '$name: filtering can only remove distance, never create it',
    ({ input }) => {
      const analysis = analyzeRun(input);
      // Computed (filtered, credited) distance can never exceed the raw
      // polyline plus a hair of floating-point slack: removing invalid
      // samples must not manufacture movement.
      expect(analysis.computedDistanceMeters).toBeLessThanOrEqual(
        analysis.rawDistanceMeters * 1.001 + 1,
      );
    },
  );

  it.each(corpus())('$name: accepted time exists only with a real crossing', ({ input }) => {
    const analysis = analyzeRun(input);
    if (analysis.acceptedTimeSeconds !== null) {
      expect(analysis.verdict).toBe('verified');
      // The crossing exists: computed distance reached the requirement.
      expect(analysis.computedDistanceMeters).toBeGreaterThanOrEqual(
        input.requiredDistanceMeters,
      );
      // And it happened inside the run, after it started.
      expect(analysis.acceptedTimeSeconds).toBeGreaterThan(0);
      expect(analysis.acceptedTimeSeconds).toBeLessThanOrEqual(analysis.elapsedSeconds);
      expect(analysis.acceptedTimeUncertaintySeconds).not.toBeNull();
    }
    if (analysis.verdict !== 'verified') {
      expect(analysis.acceptedTimeSeconds).toBeNull();
    }
  });

  it.each(corpus())('$name: verified verdicts clear the uncertainty margin', ({ input }) => {
    const analysis = analyzeRun(input);
    if (analysis.verdict === 'verified') {
      expect(analysis.computedDistanceMeters).toBeGreaterThanOrEqual(
        input.requiredDistanceMeters + analysis.distanceUncertaintyMeters,
      );
    }
  });

  it.each(corpus())('$name: version stamps are always present and current', ({ input }) => {
    const analysis = analyzeRun(input);
    expect(analysis.engine).toBe('run_gps');
    expect(analysis.engineVersion).toBe(RUN_ENGINE_VERSION);
    expect(analysis.rulesetVersion).toBe(RUN_RULESET_VERSION);
  });

  it('the engine consumes no claimed value — by type and by construction', () => {
    // RunAnalysisInput has no field for the candidate's claim: the engine
    // cannot be influenced by it because it never sees it. This test exists
    // so removing that property becomes a visible decision.
    const input: RunAnalysisInput = {
      trace: makeTrace({ durationSeconds: 700, speedAt: () => 3.6 }),
      requiredDistanceMeters: MILE_1_5,
    };
    expect('claimedValue' in input).toBe(false);
    expect('claimedTime' in input).toBe(false);
  });

  it('identical performances yield identical fingerprints; different routes differ', () => {
    const a = makeTruthTrace({ durationSeconds: 700, speedAt: () => 3.6, jitterSeed: 1 });
    const b = makeTruthTrace({ durationSeconds: 700, speedAt: () => 3.6, jitterSeed: 1 });
    const c = addJitter(
      makeLoopTrace({ durationSeconds: 700, speedMps: 3.6, sideA: 100, sideB: 100 }),
      0,
      'white',
      1,
    );
    const fingerprint = (trace: RunTrace) =>
      analyzeRun({ trace, requiredDistanceMeters: MILE_1_5 }).routeFingerprint;
    expect(fingerprint(a.trace)).toBe(fingerprint(b.trace));
    expect(fingerprint(a.trace)).not.toBe(fingerprint(c));
  });
});

describe('replay resistance (engine layer)', () => {
  const perfectRun = makeTrace({ durationSeconds: 690, speedAt: () => 3.6 });

  it('a trace recorded before this session window abstains', () => {
    const analysis = analyzeRun({
      trace: perfectRun,
      requiredDistanceMeters: MILE_1_5,
      sessionWindow: { openedAtMs: T0 + 3_600_000, closedAtMs: T0 + 7_200_000 },
    });
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('outside_session_window');
  });

  it("a trace recorded during someone else's earlier session abstains here", () => {
    // Cross-user replay: same bytes, different session window. The engine
    // sees only times — and the times do not fit. (The database layer
    // additionally rejects the bytes themselves: the content hash is
    // globally unique across all candidates, so the file cannot even be
    // committed twice.)
    const analysis = analyzeRun({
      trace: perfectRun,
      requiredDistanceMeters: MILE_1_5,
      sessionWindow: { openedAtMs: T0 - 7_200_000, closedAtMs: T0 - 3_600_000 },
    });
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('outside_session_window');
  });

  it('a trace that ends after the window closed abstains', () => {
    const analysis = analyzeRun({
      trace: perfectRun,
      requiredDistanceMeters: MILE_1_5,
      sessionWindow: { openedAtMs: T0 - 10_000, closedAtMs: T0 + 300_000 },
    });
    expect(analysis.verdict).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('outside_session_window');
  });

  it('KNOWN LIMITATION: a timestamp-rewritten replay is not detectable from the trace alone', () => {
    // An attacker who rewrites every timestamp to fit the new window
    // produces a trace this engine cannot distinguish from a fresh run.
    // What stands in the way today: rewritten bytes get a new hash, so the
    // in-app capture path (no gallery, hash at capture-stop, upload of the
    // captured file) must be subverted first — rooted-device territory.
    // The routeFingerprint is stored per analysis precisely so future
    // cross-attempt route-similarity checks can hunt this pattern. This
    // test documents the gap honestly rather than pretending it is closed.
    const shifted: RunTrace = {
      ...perfectRun,
      samples: perfectRun.samples.map((sample) => ({
        ...sample,
        t: sample.t + 86_400_000,
      })),
    };
    const analysis = analyzeRun({
      trace: shifted,
      requiredDistanceMeters: MILE_1_5,
      sessionWindow: {
        openedAtMs: T0 + 86_400_000 - 10_000,
        closedAtMs: T0 + 86_400_000 + 3_600_000,
      },
    });
    expect(analysis.verdict).toBe('verified');
  });
});
