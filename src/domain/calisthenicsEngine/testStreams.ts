import type {
  CalisthenicsLandmarks,
  LandmarkFrame,
  LandmarkPoint,
  LandmarkStream,
} from './types';

/**
 * Synthetic landmark-stream builders — the analyzer's testTraces.
 *
 * Geometrically consistent by construction: streams are driven through the
 * wrist-to-shoulder distance, so the elbow angle the analyzer derives from
 * landmark positions matches the intent of each rep spec exactly (law of
 * cosines), and chin height, shoulder height and arm pose can never
 * contradict each other.
 *
 * Deliberately varied (owner guardrail): athletes differ in proportions,
 * hang depth, sway and grip; reps differ in tempo, hold, hang and depth;
 * noise is asymmetric per side. The rule engine must survive humans, not
 * just trajectories it effectively generated for itself — nothing here
 * produces one canonical "perfect pull-up".
 */

/** Deterministic pseudo-random in [0, 1). */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

export interface AthleteBody {
  barY: number;
  /** Upper-arm = forearm segment length (image units). */
  armSegment: number;
  /** Chin sits this far above the shoulder line. */
  chinAboveShoulder: number;
  torsoLength: number;
  gripHalfWidth: number;
  shoulderHalfWidth: number;
  centerX: number;
  /** Baseline slow body sway amplitude. */
  swayAmplitude: number;
  /** Elbow angle at the dead hang (varies per athlete, 168–176). */
  hangAngleDeg: number;
}

/** A varied, plausible athlete derived from a seed. */
export function makeAthlete(seed: number): AthleteBody {
  const random = lcg(seed * 7919 + 13);
  const armSegment = 0.09 + random() * 0.04; // 0.09–0.13
  const shoulderHalfWidth = 0.05 + random() * 0.03;
  return {
    barY: 0.18 + random() * 0.06,
    armSegment,
    chinAboveShoulder: 0.08 * (armSegment / 0.11) * (0.9 + random() * 0.2),
    torsoLength: 0.16 + random() * 0.05,
    // Hands directly above the shoulders, so the planar arm triangle the
    // frames encode is exactly the one the analyzer measures.
    gripHalfWidth: shoulderHalfWidth,
    shoulderHalfWidth,
    centerX: 0.45 + random() * 0.1,
    swayAmplitude: 0.002 + random() * 0.004,
    hangAngleDeg: 168 + random() * 8,
  };
}

export interface RepSpec {
  ascentSeconds: number;
  topHoldSeconds: number;
  descentSeconds: number;
  hangAfterSeconds: number;
  /** Chin height above the bar at the top; negative = never cleared. */
  peakClearance: number;
  /** Elbow angle reached in the return phase. */
  lockoutAngleDeg: number;
  /** Hip swing amplitude in torso units (kipping when large). */
  kippingAmplitude: number;
}

/** A varied honest rep: tempo, hold, hang and depth all differ per rep. */
export function variedRep(random: () => number, overrides?: Partial<RepSpec>): RepSpec {
  return {
    ascentSeconds: 0.7 + random() * 1.1,
    topHoldSeconds: 0.1 + random() * 0.3,
    descentSeconds: 0.8 + random() * 1.2,
    hangAfterSeconds: 0.3 + random() * 1.2,
    peakClearance: 0.02 + random() * 0.03,
    lockoutAngleDeg: 165 + random() * 11,
    kippingAmplitude: random() * 0.1,
    ...overrides,
  };
}

export interface StreamOptions {
  athlete?: AthleteBody;
  seed?: number;
  fps?: number;
  /** Landmark position noise amplitude (uniform, image units). */
  noiseAmplitude?: number;
  /** Left-side landmarks get noise scaled by this (asymmetric cameras). */
  leftNoiseMultiplier?: number;
  /** Base per-frame visibility (jittered slightly). */
  visibilityBase?: number;
  /** Windows during which core landmarks drop to near-invisible. */
  dropoutWindows?: readonly { startMs: number; endMs: number }[];
  leadInHangSeconds?: number;
}

function distanceForAngle(angleDeg: number, segment: number): number {
  return 2 * segment * Math.sin(((angleDeg / 2) * Math.PI) / 180);
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
}

/**
 * Builds a pull-up landmark stream from rep specs.
 *
 * The performance is driven through d(t) — the wrist→shoulder distance —
 * from which shoulder, elbow (law of cosines) and chin positions follow.
 */
export function makePullUpStream(
  reps: readonly RepSpec[],
  options: StreamOptions = {},
): LandmarkStream {
  const seed = options.seed ?? 42;
  const random = lcg(seed);
  const athlete = options.athlete ?? makeAthlete(seed);
  const fps = options.fps ?? 30;
  const noiseAmplitude = options.noiseAmplitude ?? 0.0015;
  const leftMultiplier = options.leftNoiseMultiplier ?? 1.5;
  const visibilityBase = options.visibilityBase ?? 0.92;
  const dropouts = options.dropoutWindows ?? [];
  const leadIn = options.leadInHangSeconds ?? 2;

  const dHang = distanceForAngle(athlete.hangAngleDeg, athlete.armSegment);
  const dMin = distanceForAngle(30, athlete.armSegment);
  const dMax = distanceForAngle(178, athlete.armSegment);
  const dForClearance = (clearance: number) =>
    Math.min(dMax, Math.max(dMin, athlete.chinAboveShoulder - clearance));
  const dForLockout = (angleDeg: number) =>
    Math.min(dMax, distanceForAngle(angleDeg, athlete.armSegment));

  // Phase plan: (d start, d end, seconds, kipping amplitude).
  const phases: { from: number; to: number; seconds: number; kip: number }[] = [];
  phases.push({ from: dHang, to: dHang, seconds: leadIn, kip: 0 });
  reps.forEach((rep, index) => {
    const start = index === 0 ? dHang : phases[phases.length - 1]!.to;
    const dTop = dForClearance(rep.peakClearance);
    const dLock = dForLockout(rep.lockoutAngleDeg);
    phases.push({ from: start, to: dTop, seconds: rep.ascentSeconds, kip: rep.kippingAmplitude });
    phases.push({ from: dTop, to: dTop, seconds: rep.topHoldSeconds, kip: rep.kippingAmplitude });
    phases.push({ from: dTop, to: dLock, seconds: rep.descentSeconds, kip: rep.kippingAmplitude });
    if (rep.hangAfterSeconds > 0) {
      phases.push({ from: dLock, to: dLock, seconds: rep.hangAfterSeconds, kip: 0 });
    }
  });

  const frames: LandmarkFrame[] = [];
  const totalSeconds = phases.reduce((sum, phase) => sum + phase.seconds, 0);
  const frameCount = Math.floor(totalSeconds * fps);

  const noise = (multiplier: number) =>
    (random() * 2 - 1) * noiseAmplitude * multiplier;
  const point = (x: number, y: number, visibility: number, left: boolean): LandmarkPoint => ({
    x: x + noise(left ? leftMultiplier : 1),
    y: y + noise(left ? leftMultiplier : 1),
    visibility,
  });

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const tSeconds = frameIndex / fps;
    const tMs = Math.round(tSeconds * 1000);

    // Locate the phase.
    let remaining = tSeconds;
    let phase = phases[phases.length - 1]!;
    for (const candidate of phases) {
      if (remaining <= candidate.seconds) {
        phase = candidate;
        break;
      }
      remaining -= candidate.seconds;
    }
    const progress = phase.seconds > 0 ? Math.min(1, remaining / phase.seconds) : 1;
    const d = phase.from + (phase.to - phase.from) * easeInOut(progress);

    // Visibility, with dropouts.
    const inDropout = dropouts.some(
      (window) => tMs >= window.startMs && tMs <= window.endMs,
    );
    const vis = inDropout
      ? 0.1
      : Math.min(1, Math.max(0.5, visibilityBase + (random() - 0.5) * 0.08));

    // Geometry.
    const sway = athlete.swayAmplitude * Math.sin(tSeconds * 0.7 * Math.PI * 2);
    const kip =
      phase.kip * athlete.torsoLength * Math.sin(tSeconds * 1.4 * Math.PI * 2);
    const cx = athlete.centerX + sway;

    const wristY = athlete.barY;
    const shoulderY = athlete.barY + d;
    const chinY = shoulderY - athlete.chinAboveShoulder;
    const hipY = shoulderY + athlete.torsoLength;

    // Elbow via the isosceles triangle (equal arm segments): it sits at the
    // midpoint of the wrist→shoulder chord, flared laterally.
    const u = athlete.armSegment;
    const flare = Math.sqrt(Math.max(0, u * u - (d / 2) ** 2));
    const elbowY = wristY + d / 2;
    const leftGripX = cx - athlete.gripHalfWidth;
    const rightGripX = cx + athlete.gripHalfWidth;

    const landmarks: CalisthenicsLandmarks = {
      chin: point(cx, chinY, vis, false),
      leftWrist: point(leftGripX, wristY, vis, true),
      rightWrist: point(rightGripX, wristY, vis, false),
      leftElbow: point(leftGripX - flare, elbowY, vis, true),
      rightElbow: point(rightGripX + flare, elbowY, vis, false),
      leftShoulder: point(cx - athlete.shoulderHalfWidth, shoulderY, vis, true),
      rightShoulder: point(cx + athlete.shoulderHalfWidth, shoulderY, vis, false),
      leftHip: point(cx - 0.04 + kip, hipY, vis, true),
      rightHip: point(cx + 0.04 + kip, hipY, vis, false),
      leftKnee: point(cx - 0.04 + kip * 1.3, hipY + 0.15, vis, true),
      rightKnee: point(cx + 0.04 + kip * 1.3, hipY + 0.15, vis, false),
      leftAnkle: point(cx - 0.04 + kip * 1.6, hipY + 0.3, vis, true),
      rightAnkle: point(cx + 0.04 + kip * 1.6, hipY + 0.3, vis, false),
    };

    frames.push({ tMs, landmarks });
  }

  return {
    formatVersion: 1,
    extractorName: 'synthetic',
    extractorVersion: '1',
    sourceEvidenceId: null,
    sourceEvidenceHash: null,
    frames,
  };
}

/** A varied honest set: n clean reps, no two alike. */
export function makeCleanSet(
  seed: number,
  repCount: number,
  streamOptions: StreamOptions = {},
): LandmarkStream {
  const random = lcg(seed * 31 + 7);
  const reps = Array.from({ length: repCount }, () => variedRep(random));
  return makePullUpStream(reps, { seed, ...streamOptions });
}
