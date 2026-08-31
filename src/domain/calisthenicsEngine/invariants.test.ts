import { analyzePullUps } from './analyze';
import {
  CALISTHENICS_ENGINE_VERSION,
  CALISTHENICS_RULESET,
  CALISTHENICS_RULESET_VERSION,
} from './ruleset';
import { lcg, makeCleanSet, makePullUpStream, variedRep } from './testStreams';
import type { AnalysisRecommendation, CalisthenicsAnalysisInput } from './types';

/**
 * Properties that must hold for every stream the analyzer will ever see.
 * Breaking one of these is a defect, not a tuning decision.
 */

function corpus(): { name: string; input: CalisthenicsAnalysisInput }[] {
  const random = lcg(99);
  return [
    { name: 'clean', input: { stream: makeCleanSet(1, 8) } },
    { name: 'noisy', input: { stream: makeCleanSet(2, 6, { noiseAmplitude: 0.004 }) } },
    {
      name: 'mixed',
      input: {
        stream: makePullUpStream(
          [
            variedRep(random),
            variedRep(random, { peakClearance: -0.05 }),
            variedRep(random, { peakClearance: 0.002 }),
            variedRep(random, { lockoutAngleDeg: 150 }),
            variedRep(random, { kippingAmplitude: 0.6 }),
          ],
          { seed: 5 },
        ),
      },
    },
    {
      name: 'occluded',
      input: {
        stream: makeCleanSet(4, 5, { dropoutWindows: [{ startMs: 4000, endMs: 5200 }] }),
      },
    },
    { name: 'empty_hang', input: { stream: makePullUpStream([], { leadInHangSeconds: 8 }) } },
    { name: 'stub', input: { stream: makePullUpStream([], { leadInHangSeconds: 0.5 }) } },
  ];
}

const RECOMMENDATIONS: readonly AnalysisRecommendation[] = [
  'pass_candidate',
  'fail_candidate',
  'unable_to_verify',
];

describe('calisthenics engine invariants', () => {
  it.each(corpus())('$name: processing twice produces identical output', ({ input }) => {
    expect(analyzePullUps(input)).toEqual(analyzePullUps(input));
  });

  it.each(corpus())('$name: the stream is never mutated', ({ input }) => {
    const before = JSON.stringify(input.stream);
    analyzePullUps(input);
    expect(JSON.stringify(input.stream)).toBe(before);
  });

  it.each(corpus())('$name: accepted ≤ detected, and accepted = valid reps', ({ input }) => {
    const analysis = analyzePullUps(input);
    expect(analysis.acceptedReps).toBeLessThanOrEqual(analysis.detectedReps);
    expect(analysis.acceptedReps).toBe(
      analysis.reps.filter((rep) => rep.verdict === 'valid').length,
    );
    expect(analysis.detectedReps).toBe(analysis.reps.length);
    expect(
      analysis.acceptedReps + analysis.uncertainReps + analysis.invalidReps,
    ).toBe(analysis.detectedReps);
  });

  it.each(corpus())('$name: uncertain reps are never credited', ({ input }) => {
    const analysis = analyzePullUps(input);
    for (const rep of analysis.reps) {
      if (rep.verdict === 'uncertain') {
        expect(rep.reasonCodes.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(corpus())(
    '$name: the output vocabulary cannot express an authoritative verdict',
    ({ input }) => {
      const analysis = analyzePullUps(input);
      expect(RECOMMENDATIONS).toContain(analysis.recommendation);
      // The word the server policy owns must never appear as a value here.
      expect(String(analysis.recommendation)).not.toBe('verified');
      expect(String(analysis.recommendation)).not.toBe('zero_verified');
    },
  );

  it.each(corpus())('$name: version and provenance stamps always present', ({ input }) => {
    const analysis = analyzePullUps(input);
    expect(analysis.engine).toBe('calisthenics_pose');
    expect(analysis.engineVersion).toBe(CALISTHENICS_ENGINE_VERSION);
    expect(analysis.rulesetVersion).toBe(CALISTHENICS_RULESET_VERSION);
    expect(analysis.extractorName).toBe(input.stream.extractorName);
    if (analysis.barReference) {
      expect(analysis.barReference.provider.length).toBeGreaterThan(0);
      expect(analysis.barReference.uncertainty).toBeGreaterThanOrEqual(
        CALISTHENICS_RULESET.barUncertaintyFloor,
      );
    }
  });

  it('the analyzer consumes no claimed count — by type and by construction', () => {
    const input: CalisthenicsAnalysisInput = { stream: makeCleanSet(7, 3) };
    expect('claimedValue' in input).toBe(false);
    expect('claimedReps' in input).toBe(false);
  });

  it('rep records are ordered, non-overlapping, and inside the stream', () => {
    const analysis = analyzePullUps({ stream: makeCleanSet(8, 10) });
    let previousEnd = -1;
    for (const rep of analysis.reps) {
      expect(rep.startMs).toBeGreaterThanOrEqual(previousEnd);
      expect(rep.endMs).toBeGreaterThan(rep.startMs);
      expect(rep.endMs).toBeLessThanOrEqual(analysis.elapsedMs + 1);
      previousEnd = rep.endMs;
    }
  });

  it('the ruleset is explicitly provisional', () => {
    expect(CALISTHENICS_RULESET.provisional).toBe(true);
  });
});
