import { analyzePullUps } from './analyze';
import { CALISTHENICS_RULESET } from './ruleset';
import { lcg, makeCleanSet, makePullUpStream, variedRep, type RepSpec } from './testStreams';

/**
 * The pull-up analyzer adversarial suite. Each case documents the verdict
 * the ruleset owes it. Streams are deliberately varied — different synthetic
 * athletes, tempos, holds and noise — so the machine is validated against
 * human-like variation, not against one trajectory it effectively generated
 * for itself.
 */

function specs(seed: number, overrides: Partial<RepSpec>[], base?: Partial<RepSpec>): RepSpec[] {
  const random = lcg(seed);
  return overrides.map((override) => variedRep(random, { ...base, ...override }));
}

describe('honest sets', () => {
  it.each([1, 2, 3, 4, 5])('counts a varied clean set exactly (athlete %d)', (seed) => {
    const analysis = analyzePullUps({ stream: makeCleanSet(seed, 8) });
    expect(analysis.recommendation).toBe('pass_candidate');
    expect(analysis.detectedReps).toBe(8);
    expect(analysis.acceptedReps).toBe(8);
    expect(analysis.uncertainReps).toBe(0);
    expect(analysis.invalidReps).toBe(0);
  });

  it('slow grinding reps and fast smooth reps both count', () => {
    const reps = specs(11, [
      { ascentSeconds: 2.4, descentSeconds: 2.6, topHoldSeconds: 0.5 },
      { ascentSeconds: 0.8, descentSeconds: 0.9, topHoldSeconds: 0.1 },
      { ascentSeconds: 1.6, descentSeconds: 1.1, topHoldSeconds: 0.3 },
    ]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 11 }) });
    expect(analysis.recommendation).toBe('pass_candidate');
    expect(analysis.acceptedReps).toBe(3);
  });

  it('a single honest rep counts', () => {
    const analysis = analyzePullUps({
      stream: makePullUpStream(specs(3, [{}]), { seed: 3 }),
    });
    expect(analysis.acceptedReps).toBe(1);
    expect(analysis.recommendation).toBe('pass_candidate');
  });

  it('mild sway on an honest set does not flag kipping', () => {
    const analysis = analyzePullUps({
      stream: makeCleanSet(7, 6),
    });
    expect(analysis.anomalies.some((a) => a.code === 'kipping_flagged')).toBe(false);
  });
});

describe('invalid reps — positive evidence', () => {
  it('excludes chin-short reps with reasons, keeps the good ones', () => {
    const reps = specs(21, [
      {},
      { peakClearance: -0.04 }, // clearly short
      {},
      { peakClearance: -0.05 },
      {},
    ]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 21 }) });
    expect(analysis.detectedReps).toBe(5);
    expect(analysis.acceptedReps).toBe(3);
    expect(analysis.invalidReps).toBe(2);
    const invalid = analysis.reps.filter((rep) => rep.verdict === 'invalid');
    expect(invalid.every((rep) => rep.reasonCodes.includes('chin_below_bar'))).toBe(true);
    expect(analysis.recommendation).toBe('pass_candidate');
  });

  it('excludes no-lockout reps', () => {
    const reps = specs(22, [
      {},
      { lockoutAngleDeg: 145 }, // clearly no extension
      {},
    ]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 22 }) });
    expect(analysis.acceptedReps).toBe(2);
    expect(analysis.invalidReps).toBe(1);
    expect(
      analysis.reps.find((rep) => rep.verdict === 'invalid')!.reasonCodes,
    ).toContain('incomplete_extension');
  });

  it('recommends fail_candidate when every attempt is confidently invalid', () => {
    const reps = specs(23, [
      { peakClearance: -0.05 },
      { peakClearance: -0.06 },
      { peakClearance: -0.05 },
      { peakClearance: -0.07 },
    ]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 23 }) });
    expect(analysis.acceptedReps).toBe(0);
    expect(analysis.invalidReps).toBe(4);
    expect(analysis.recommendation).toBe('fail_candidate');
    expect(analysis.reasonCodes).toContain('no_valid_reps');
  });
});

describe('uncertain reps — never credited, never punished', () => {
  it('marks marginal chin clearance uncertain and does not credit it', () => {
    const reps = specs(31, [{}, { peakClearance: 0.002 }, {}, {}, {}, {}, {}, {}]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 31 }) });
    expect(analysis.acceptedReps).toBe(7);
    expect(analysis.uncertainReps).toBe(1);
    const uncertain = analysis.reps.find((rep) => rep.verdict === 'uncertain')!;
    expect(uncertain.reasonCodes).toContain('chin_clearance_uncertain');
    // 1/8 uncertain is under the abstention fraction: still a pass candidate.
    expect(analysis.recommendation).toBe('pass_candidate');
  });

  it('marks marginal lockout uncertain', () => {
    const reps = specs(32, [{}, { lockoutAngleDeg: 157 }, {}, {}, {}, {}, {}, {}]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 32 }) });
    expect(analysis.uncertainReps).toBe(1);
    expect(
      analysis.reps.find((rep) => rep.verdict === 'uncertain')!.reasonCodes,
    ).toContain('lockout_uncertain');
  });

  it('abstains the event when too many reps are uncertain', () => {
    const reps = specs(33, [
      { peakClearance: 0.002 },
      { peakClearance: 0.003 },
      { peakClearance: 0.002 },
      {},
      {},
    ]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 33 }) });
    expect(analysis.recommendation).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('rep_judgment_uncertain');
    expect(analysis.acceptedReps).toBe(2); // still reported, still not a verdict
  });
});

describe('kipping (owner decision 1: flag → uncertain, never auto-invalidate)', () => {
  it('flags heavy swing, resolves reps to uncertain, and never invalidates', () => {
    const reps = specs(41, [
      { kippingAmplitude: 0.6 },
      { kippingAmplitude: 0.7 },
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
    ]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 41 }) });
    const kipped = analysis.reps.filter((rep) =>
      rep.reasonCodes.includes('excessive_swing'),
    );
    expect(kipped.length).toBeGreaterThanOrEqual(2);
    expect(kipped.every((rep) => rep.verdict === 'uncertain')).toBe(true);
    expect(analysis.invalidReps).toBe(0);
    expect(analysis.anomalies.some((a) => a.code === 'kipping_flagged')).toBe(true);
  });
});

describe('occlusion and frame loss', () => {
  it('reps under a visibility dropout are uncertain, not judged', () => {
    // Dropout covering roughly the second rep of a four-rep set.
    const reps = specs(51, [{}, {}, {}, {}], {
      ascentSeconds: 1,
      descentSeconds: 1,
      topHoldSeconds: 0.2,
      hangAfterSeconds: 0.8,
    });
    const analysis = analyzePullUps({
      stream: makePullUpStream(reps, {
        seed: 51,
        dropoutWindows: [{ startMs: 5_000, endMs: 6_600 }],
      }),
    });
    expect(analysis.uncertainReps).toBeGreaterThanOrEqual(1);
    const occluded = analysis.reps.filter(
      (rep) =>
        rep.reasonCodes.includes('landmarks_occluded') ||
        rep.reasonCodes.includes('observation_gap'),
    );
    expect(occluded.length).toBeGreaterThanOrEqual(1);
    expect(occluded.every((rep) => rep.verdict !== 'valid')).toBe(true);
  });

  it('abstains the whole event when the athlete leaves frame for too long', () => {
    const analysis = analyzePullUps({
      stream: makeCleanSet(52, 6, {
        dropoutWindows: [{ startMs: 4_000, endMs: 9_000 }],
      }),
    });
    expect(analysis.recommendation).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('framing_lost');
  });
});

describe('bar reference', () => {
  it('abstains when no stable hang exists to establish the bar', () => {
    // No lead-in hang and immediate continuous motion: the v1 provider has
    // nothing to measure the bar from.
    const reps = specs(61, [{ hangAfterSeconds: 0 }], {});
    const analysis = analyzePullUps({
      stream: makePullUpStream(reps, { seed: 61, leadInHangSeconds: 0.05 }),
    });
    expect(analysis.recommendation).toBe('unable_to_verify');
    expect(analysis.reasonCodes.some((code) =>
      ['bar_reference_unavailable', 'no_reps_detected', 'insufficient_data'].includes(code),
    )).toBe(true);
  });

  it('accepts an externally supplied bar reference (the interface, not the provider)', () => {
    const stream = makeCleanSet(62, 5);
    const withProvided = analyzePullUps({
      stream,
      barReference: {
        provider: 'external_test',
        providerVersion: '9',
        lineY: 0.21,
        uncertainty: 0.006,
      },
    });
    expect(withProvided.barReference?.provider).toBe('external_test');
  });
});

describe('cadence and manipulation', () => {
  it('abstains on repeated beyond-human cadence', () => {
    const reps = specs(71, [
      { ascentSeconds: 0.15, descentSeconds: 0.15, topHoldSeconds: 0, hangAfterSeconds: 0.05 },
      { ascentSeconds: 0.15, descentSeconds: 0.15, topHoldSeconds: 0, hangAfterSeconds: 0.05 },
      { ascentSeconds: 0.15, descentSeconds: 0.15, topHoldSeconds: 0, hangAfterSeconds: 0.05 },
      {},
    ]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 71 }) });
    expect(analysis.recommendation).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('implausible_cadence');
    expect(analysis.anomalies.some((a) => a.code === 'implausible_cadence')).toBe(true);
  });

  it('abstains rather than judging a stub stream', () => {
    const analysis = analyzePullUps({
      stream: makePullUpStream(specs(72, [{}]), { seed: 72, leadInHangSeconds: 0 }),
    });
    // Short stream: either insufficient data or bar problems — never a pass.
    expect(analysis.recommendation).not.toBe('pass_candidate');
  });

  it('an empty hang with no attempts abstains as no_reps_detected', () => {
    const analysis = analyzePullUps({
      stream: makePullUpStream([], { seed: 73, leadInHangSeconds: 8 }),
    });
    expect(analysis.recommendation).toBe('unable_to_verify');
    expect(analysis.reasonCodes).toContain('no_reps_detected');
  });
});

describe('structured output', () => {
  it('claimed/detected/accepted separation: accepted is traceable to rep records', () => {
    const reps = specs(81, [{}, { peakClearance: -0.05 }, {}, { lockoutAngleDeg: 145 }, {}]);
    const analysis = analyzePullUps({ stream: makePullUpStream(reps, { seed: 81 }) });
    expect(analysis.detectedReps).toBe(5);
    expect(analysis.acceptedReps).toBe(3);
    expect(analysis.reps.filter((rep) => rep.verdict === 'valid').length).toBe(
      analysis.acceptedReps,
    );
    for (const rep of analysis.reps) {
      expect(rep.endMs).toBeGreaterThan(rep.startMs);
      expect(rep.metrics.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('stamps engine, ruleset, extractor and bar provider on every analysis', () => {
    const analysis = analyzePullUps({ stream: makeCleanSet(91, 4) });
    expect(analysis.engine).toBe('calisthenics_pose');
    expect(analysis.engineVersion).toBe('1');
    expect(analysis.rulesetVersion).toBe(1);
    expect(analysis.extractorName).toBe('synthetic');
    expect(analysis.barReference?.provider).toBe('wrist_hang_median');
    expect(CALISTHENICS_RULESET.provisional).toBe(true);
  });
});
