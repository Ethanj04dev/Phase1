/**
 * Geometry for the honest gauge.
 *
 * The signature visual of the product: the arc's *length* is coverage — how
 * much of the athlete's target is actually measured — and the accent fill is
 * the score within that measured span. An athlete at 73% coverage sees 73% of
 * an instrument, with the unmeasured remainder left as a visible gap.
 *
 * Every competitor draws a complete ring no matter how little they know.
 * This one cannot, structurally: an unmeasured domain has no arc to draw on.
 *
 * Pure functions, separated from the SVG component so the trigonometry is
 * unit-testable without rendering anything.
 */

/** Total sweep of a complete instrument, degrees. 270° reads as a gauge
 * rather than a ring, and leaves the bottom gap for the band label. */
export const GAUGE_SWEEP_DEGREES = 270;

/** The gauge opens downward: sweep runs clockwise from bottom-left. With 270°
 * of sweep, start sits at 135° measured clockwise from 12 o'clock. */
export const GAUGE_START_DEGREES = -135;

export interface GaugeArcs {
  /** Sweep of the measured span, degrees. */
  measuredSweep: number;
  /** Sweep of the accent fill inside the measured span, degrees. */
  scoreSweep: number;
  /** Sweep of the unmeasured gap, degrees. Zero when fully covered. */
  gapSweep: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Splits the instrument's sweep into measured, filled and missing.
 *
 * @param score 0–100, already renormalised over measured weight.
 * @param coverage 0–1, share of the target's weighted profile that has data.
 */
export function gaugeArcs(score: number, coverage: number): GaugeArcs {
  const measuredSweep = GAUGE_SWEEP_DEGREES * clamp01(coverage);
  const scoreSweep = measuredSweep * clamp01(score / 100);
  return {
    measuredSweep,
    scoreSweep,
    gapSweep: GAUGE_SWEEP_DEGREES - measuredSweep,
  };
}

export interface Point {
  x: number;
  y: number;
}

/** A point on the gauge circle. 0° is 12 o'clock; positive is clockwise. */
export function pointOnGauge(
  center: number,
  radius: number,
  degreesFromTop: number,
): Point {
  const radians = ((degreesFromTop - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

/**
 * SVG path for an arc segment of the gauge.
 *
 * @param startDeg degrees from 12 o'clock, clockwise.
 * @param sweepDeg degrees of arc, clockwise from startDeg. Sweeps of ~0 return
 *   an empty path rather than a degenerate arc the renderer may draw wrongly.
 */
export function gaugeArcPath(
  center: number,
  radius: number,
  startDeg: number,
  sweepDeg: number,
): string {
  if (sweepDeg <= 0.01) {
    return '';
  }
  // SVG arcs cannot express a full circle in one segment; cap just below.
  const sweep = Math.min(sweepDeg, 359.99);
  const from = pointOnGauge(center, radius, startDeg);
  const to = pointOnGauge(center, radius, startDeg + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${from.x.toFixed(3)} ${from.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x.toFixed(3)} ${to.y.toFixed(3)}`;
}

/**
 * Tick marks across the unmeasured gap.
 *
 * The gap is not empty space — it is the part of the instrument that does not
 * exist yet, and the faint ticks are what make it read as "missing" rather
 * than "finished". Roughly one tick per 9° of gap, clamped so a sliver of
 * missing coverage still shows at least two.
 */
export function gapTickAngles(gapSweep: number): readonly number[] {
  if (gapSweep <= 0.01) {
    return [];
  }
  const count = Math.max(2, Math.round(gapSweep / 9));
  const gapStart = GAUGE_START_DEGREES + (GAUGE_SWEEP_DEGREES - gapSweep);
  const step = gapSweep / (count + 1);
  return Array.from({ length: count }, (_, index) => gapStart + step * (index + 1));
}
