import {
  GAUGE_START_DEGREES,
  GAUGE_SWEEP_DEGREES,
  gapTickAngles,
  gaugeArcPath,
  gaugeArcs,
  pointOnGauge,
} from './gaugeGeometry';

describe('gauge arcs', () => {
  // The honest-gauge invariant: the instrument's length is coverage.
  it('draws only the measured portion of the instrument', () => {
    const arcs = gaugeArcs(64, 0.73);
    expect(arcs.measuredSweep).toBeCloseTo(GAUGE_SWEEP_DEGREES * 0.73, 5);
    expect(arcs.gapSweep).toBeCloseTo(GAUGE_SWEEP_DEGREES * 0.27, 5);
  });

  it('fills the score within the measured span, not the whole instrument', () => {
    const arcs = gaugeArcs(50, 0.5);
    // Half a score on half an instrument is a quarter of the full sweep.
    expect(arcs.scoreSweep).toBeCloseTo(GAUGE_SWEEP_DEGREES * 0.25, 5);
  });

  it('closes the gap entirely at full coverage', () => {
    const arcs = gaugeArcs(80, 1);
    expect(arcs.gapSweep).toBeCloseTo(0, 5);
    expect(arcs.measuredSweep).toBeCloseTo(GAUGE_SWEEP_DEGREES, 5);
  });

  it('shows an instrument with no fill for a zero score, not no instrument', () => {
    // Scoring zero and being unmeasured are different states, here as
    // everywhere else in the product.
    const arcs = gaugeArcs(0, 0.8);
    expect(arcs.scoreSweep).toBe(0);
    expect(arcs.measuredSweep).toBeGreaterThan(0);
  });

  it('clamps out-of-range and non-finite inputs instead of drawing nonsense', () => {
    expect(gaugeArcs(140, 1.4).scoreSweep).toBeLessThanOrEqual(GAUGE_SWEEP_DEGREES);
    expect(gaugeArcs(-10, 0.5).scoreSweep).toBe(0);
    expect(gaugeArcs(Number.NaN, Number.NaN).measuredSweep).toBe(0);
  });

  it('always sums to the full instrument', () => {
    for (const [score, coverage] of [
      [64, 0.73],
      [0, 0],
      [100, 1],
      [37, 0.11],
    ] as const) {
      const arcs = gaugeArcs(score, coverage);
      expect(arcs.measuredSweep + arcs.gapSweep).toBeCloseTo(GAUGE_SWEEP_DEGREES, 5);
    }
  });
});

describe('points on the gauge circle', () => {
  it('puts 0 degrees at 12 oclock', () => {
    const point = pointOnGauge(50, 40, 0);
    expect(point.x).toBeCloseTo(50, 5);
    expect(point.y).toBeCloseTo(10, 5);
  });

  it('sweeps clockwise', () => {
    const point = pointOnGauge(50, 40, 90);
    expect(point.x).toBeCloseTo(90, 5);
    expect(point.y).toBeCloseTo(50, 5);
  });

  it('starts the gauge at the bottom-left shoulder', () => {
    const start = pointOnGauge(50, 40, GAUGE_START_DEGREES);
    expect(start.x).toBeLessThan(50);
    expect(start.y).toBeGreaterThan(50);
  });
});

describe('arc paths', () => {
  it('emits an SVG arc command', () => {
    const path = gaugeArcPath(50, 40, GAUGE_START_DEGREES, 90);
    expect(path).toMatch(/^M [\d.-]+ [\d.-]+ A 40 40 0 0 1 [\d.-]+ [\d.-]+$/);
  });

  it('flags the large-arc bit past 180 degrees', () => {
    const path = gaugeArcPath(50, 40, GAUGE_START_DEGREES, 200);
    expect(path).toContain(' A 40 40 0 1 1 ');
  });

  it('returns an empty path for a degenerate sweep rather than a dot', () => {
    expect(gaugeArcPath(50, 40, 0, 0)).toBe('');
    expect(gaugeArcPath(50, 40, 0, -5)).toBe('');
  });
});

describe('gap ticks', () => {
  it('marks the missing span with ticks', () => {
    const ticks = gapTickAngles(GAUGE_SWEEP_DEGREES * 0.27);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    // Every tick sits inside the gap, which occupies the end of the sweep.
    const gapStart =
      GAUGE_START_DEGREES + GAUGE_SWEEP_DEGREES - GAUGE_SWEEP_DEGREES * 0.27;
    for (const angle of ticks) {
      expect(angle).toBeGreaterThan(gapStart);
      expect(angle).toBeLessThan(GAUGE_START_DEGREES + GAUGE_SWEEP_DEGREES);
    }
  });

  it('shows at least two ticks for even a sliver of missing coverage', () => {
    expect(gapTickAngles(6).length).toBe(2);
  });

  it('marks nothing when the instrument is complete', () => {
    expect(gapTickAngles(0)).toEqual([]);
  });
});
