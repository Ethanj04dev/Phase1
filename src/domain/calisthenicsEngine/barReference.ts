import type { CALISTHENICS_RULESET } from './ruleset';
import type { FrameSignals } from './signals';
import type { BarReference } from './types';

/**
 * The v1 BarReference provider: wrist-hang median.
 *
 * During a dead hang the hands are on the bar, so the wrists ARE the bar —
 * the median wrist height across hang frames estimates the bar line, and
 * the spread of those wrist heights is the estimate's uncertainty. This is
 * one provider behind an interface, not an architectural assumption: a
 * future independent bar detector returns the same shape and the rep
 * engine never notices the change.
 */

export const WRIST_HANG_PROVIDER = 'wrist_hang_median';
export const WRIST_HANG_PROVIDER_VERSION = '1';

type Rules = typeof CALISTHENICS_RULESET;

export function wristHangBarReference(
  signals: readonly FrameSignals[],
  rules: Rules,
): BarReference | null {
  // Hang frames: arms extended, wrists seen, above the shoulders by
  // construction of a hang (wrist Y smaller than chin Y).
  const hangWristYs = signals
    .filter(
      (frame) =>
        frame.minElbowAngleDeg !== null &&
        frame.minElbowAngleDeg >= rules.hangAngleDeg &&
        frame.wristYMean !== null &&
        frame.chinY !== null &&
        frame.wristYMean < frame.chinY,
    )
    .map((frame) => frame.wristYMean as number);

  if (hangWristYs.length < rules.minHangFrames) {
    return null;
  }

  const sorted = [...hangWristYs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;

  // Spread: half the interquartile range, floored.
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const uncertainty = Math.max(rules.barUncertaintyFloor, (q3 - q1) / 2);

  return {
    provider: WRIST_HANG_PROVIDER,
    providerVersion: WRIST_HANG_PROVIDER_VERSION,
    lineY: median,
    uncertainty,
  };
}
