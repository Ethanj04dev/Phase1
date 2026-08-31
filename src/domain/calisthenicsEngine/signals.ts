import type { CALISTHENICS_RULESET } from './ruleset';
import type { CalisthenicsLandmarks, LandmarkFrame } from './types';

/**
 * Per-frame derived signals: the deterministic bridge from landmarks to the
 * state machine. Nothing here judges anything — it measures.
 */

type Rules = typeof CALISTHENICS_RULESET;

/** Angle at the elbow (shoulder–elbow–wrist), degrees; null if unseen. */
export function elbowAngleDeg(
  shoulder: { x: number; y: number; visibility: number },
  elbow: { x: number; y: number; visibility: number },
  wrist: { x: number; y: number; visibility: number },
  visibilityFloor: number,
): number | null {
  if (
    shoulder.visibility < visibilityFloor ||
    elbow.visibility < visibilityFloor ||
    wrist.visibility < visibilityFloor
  ) {
    return null;
  }
  const ax = shoulder.x - elbow.x;
  const ay = shoulder.y - elbow.y;
  const bx = wrist.x - elbow.x;
  const by = wrist.y - elbow.y;
  const magnitudes = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (magnitudes === 0) {
    return null;
  }
  const cos = Math.min(1, Math.max(-1, (ax * bx + ay * by) / magnitudes));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** The landmarks whose visibility defines "the athlete is judgeable". */
const CORE_KEYS: readonly (keyof CalisthenicsLandmarks)[] = [
  'chin',
  'leftWrist',
  'rightWrist',
  'leftElbow',
  'rightElbow',
  'leftShoulder',
  'rightShoulder',
  'leftHip',
  'rightHip',
];

export interface FrameSignals {
  tMs: number;
  /**
   * Elbow extension measure: the MINIMUM of the visible sides, so lockout
   * requires both visible arms extended; null when neither side is seen.
   */
  minElbowAngleDeg: number | null;
  chinY: number | null;
  chinVisibility: number;
  wristYMean: number | null;
  wristVisibility: number;
  hipX: number | null;
  /** Shoulder-to-hip distance — the body-proportion scale for sway. */
  torsoLength: number | null;
  coreVisibility: number;
}

export function deriveSignals(
  frames: readonly LandmarkFrame[],
  rules: Rules,
): FrameSignals[] {
  const floor = rules.framingVisibilityFloor;
  const out: FrameSignals[] = [];
  let smoothedChin: number | null = null;
  let smoothedAngle: number | null = null;

  for (const frame of frames) {
    const l = frame.landmarks;

    const left = elbowAngleDeg(l.leftShoulder, l.leftElbow, l.leftWrist, floor);
    const right = elbowAngleDeg(l.rightShoulder, l.rightElbow, l.rightWrist, floor);
    const angles = [left, right].filter((value): value is number => value !== null);
    let rawAngle: number | null;
    switch (rules.elbowAnglePolicy) {
      case 'both_sides_required':
        rawAngle = left !== null && right !== null ? Math.min(left, right) : null;
        break;
      case 'single_best_side': {
        const leftVis = Math.min(l.leftShoulder.visibility, l.leftElbow.visibility, l.leftWrist.visibility);
        const rightVis = Math.min(l.rightShoulder.visibility, l.rightElbow.visibility, l.rightWrist.visibility);
        rawAngle = leftVis >= rightVis ? (left ?? right) : (right ?? left);
        break;
      }
      case 'min_visible_sides':
        rawAngle = angles.length > 0 ? Math.min(...angles) : null;
        break;
    }

    const chinVisible = l.chin.visibility >= floor;
    const rawChin = chinVisible ? l.chin.y : null;

    // Light EMA so single-frame landmark noise cannot flip the machine.
    if (rawChin !== null) {
      smoothedChin =
        smoothedChin === null
          ? rawChin
          : smoothedChin + rules.smoothingAlpha * (rawChin - smoothedChin);
    }
    if (rawAngle !== null) {
      smoothedAngle =
        smoothedAngle === null
          ? rawAngle
          : smoothedAngle + rules.smoothingAlpha * (rawAngle - smoothedAngle);
    }

    const wrists = [l.leftWrist, l.rightWrist].filter((w) => w.visibility >= floor);
    const shoulders = [l.leftShoulder, l.rightShoulder].filter(
      (s) => s.visibility >= floor,
    );
    const hips = [l.leftHip, l.rightHip].filter((h) => h.visibility >= floor);

    const shoulderY =
      shoulders.length > 0
        ? shoulders.reduce((sum, s) => sum + s.y, 0) / shoulders.length
        : null;
    const hipY =
      hips.length > 0 ? hips.reduce((sum, h) => sum + h.y, 0) / hips.length : null;

    out.push({
      tMs: frame.tMs,
      minElbowAngleDeg: rawAngle === null ? null : smoothedAngle,
      chinY: rawChin === null ? null : smoothedChin,
      chinVisibility: l.chin.visibility,
      wristYMean:
        wrists.length > 0 ? wrists.reduce((sum, w) => sum + w.y, 0) / wrists.length : null,
      wristVisibility:
        (l.leftWrist.visibility + l.rightWrist.visibility) / 2,
      hipX: hips.length > 0 ? hips.reduce((sum, h) => sum + h.x, 0) / hips.length : null,
      torsoLength:
        shoulderY !== null && hipY !== null ? Math.abs(hipY - shoulderY) : null,
      coreVisibility:
        CORE_KEYS.reduce((sum, key) => sum + l[key].visibility, 0) / CORE_KEYS.length,
    });
  }
  return out;
}
