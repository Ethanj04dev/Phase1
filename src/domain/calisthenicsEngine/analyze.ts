import { wristHangBarReference } from './barReference';
import {
  CALISTHENICS_ENGINE_VERSION,
  CALISTHENICS_RULESET,
  CALISTHENICS_RULESET_VERSION,
} from './ruleset';
import { deriveSignals } from './signals';
import type {
  CalisthenicsAnalysis,
  CalisthenicsAnalysisInput,
  CalisthenicsAnomaly,
  PullUpDiagnostics,
  RepRecord,
  RepVerdict,
} from './types';

/**
 * The pull-up rep analyzer: landmark stream in, structured recommendation
 * out. Deterministic end to end — same stream, same ruleset, same answer.
 *
 * State machine over derived signals:
 *
 *   SEEKING → DEAD_HANG (stable extension) → PULL (flexion below the
 *   start-pull angle; chin tracked to its peak) → RETURN (extension
 *   recovering; best lockout tracked) → rep closed at lockout, or at
 *   re-descent without lockout (which opens the next attempt) → DEAD_HANG …
 *
 * Judgment is three-outcome at the rep level (valid / invalid / uncertain)
 * and the event level output is a RECOMMENDATION, never a verdict:
 * uncertain reps are never credited, ambiguity abstains, and only server
 * policy can turn any of this into an authoritative verification.
 */

/** Hysteresis constants for phase transitions (part of ruleset v1). */
const RETURN_HYSTERESIS_DEG = 8;
const REDESCENT_HYSTERESIS_DEG = 8;

interface Attempt {
  startMs: number;
  endMs: number;
  /** Closed by stream end rather than by lockout or re-descent. */
  truncated: boolean;
  peakChinY: number | null;
  chinVisibilityAtPeak: number;
  bottomAngleDeg: number;
  lockoutAngleDeg: number;
  visibilitySum: number;
  visibilityFrames: number;
  minHipX: number | null;
  maxHipX: number | null;
  torsoSum: number;
  torsoFrames: number;
}

function newAttempt(tMs: number, angle: number): Attempt {
  return {
    startMs: tMs,
    endMs: tMs,
    truncated: false,
    peakChinY: null,
    chinVisibilityAtPeak: 0,
    bottomAngleDeg: angle,
    lockoutAngleDeg: angle,
    visibilitySum: 0,
    visibilityFrames: 0,
    minHipX: null,
    maxHipX: null,
    torsoSum: 0,
    torsoFrames: 0,
  };
}

export function analyzePullUps(
  input: CalisthenicsAnalysisInput,
  diagnostics?: PullUpDiagnostics,
): CalisthenicsAnalysis {
  const rules = CALISTHENICS_RULESET;
  const { stream } = input;
  const frames = stream.frames;

  const base = {
    engine: 'calisthenics_pose' as const,
    engineVersion: CALISTHENICS_ENGINE_VERSION,
    rulesetVersion: CALISTHENICS_RULESET_VERSION,
    exercise: 'pull_ups' as const,
    extractorName: stream.extractorName,
    extractorVersion: stream.extractorVersion,
  };

  const elapsedMs =
    frames.length >= 2 ? frames[frames.length - 1]!.tMs - frames[0]!.tMs : 0;
  const fps = elapsedMs > 0 ? (frames.length / elapsedMs) * 1000 : 0;

  const abstain = (
    reasons: string[],
    extras?: Partial<CalisthenicsAnalysis>,
  ): CalisthenicsAnalysis => ({
    ...base,
    barReference: null,
    recommendation: 'unable_to_verify',
    reasonCodes: reasons,
    anomalies: [],
    detectedReps: 0,
    acceptedReps: 0,
    uncertainReps: 0,
    invalidReps: 0,
    reps: [],
    elapsedMs,
    confidences: { landmarkVisibility: 0, framing: 0, repJudgment: 0 },
    ...extras,
  });

  if (
    frames.length < rules.minFrames ||
    elapsedMs < rules.minDurationSeconds * 1000 ||
    fps < rules.minFps
  ) {
    return abstain(['insufficient_data']);
  }

  const signals = deriveSignals(frames, rules);
  const anomalies: CalisthenicsAnomaly[] = [];

  // --- Framing: how long did the camera lose the athlete? -------------------
  let lostMs = 0;
  let longestLossMs = 0;
  let currentLossStart: number | null = null;
  for (let index = 0; index < signals.length; index += 1) {
    const frame = signals[index]!;
    if (frame.coreVisibility < rules.framingVisibilityFloor) {
      currentLossStart = currentLossStart ?? frame.tMs;
    } else if (currentLossStart !== null) {
      const loss = frame.tMs - currentLossStart;
      lostMs += loss;
      longestLossMs = Math.max(longestLossMs, loss);
      currentLossStart = null;
    }
  }
  if (currentLossStart !== null) {
    const loss = signals[signals.length - 1]!.tMs - currentLossStart;
    lostMs += loss;
    longestLossMs = Math.max(longestLossMs, loss);
  }
  const framingConfidence = elapsedMs > 0 ? Math.max(0, 1 - lostMs / elapsedMs) : 0;
  const meanVisibility =
    signals.reduce((sum, frame) => sum + frame.coreVisibility, 0) / signals.length;

  if (longestLossMs > rules.maxFramingLossSeconds * 1000) {
    anomalies.push({
      code: 'framing_lost',
      severity: 'suspicious',
      detail: `The athlete was unjudgeable for ${(longestLossMs / 1000).toFixed(1)}s.`,
    });
    return abstain(['framing_lost'], {
      anomalies,
      confidences: {
        landmarkVisibility: round3(meanVisibility),
        framing: round3(framingConfidence),
        repJudgment: 0,
      },
    });
  }

  // --- Bar reference: supplied, or derived by the v1 provider. ---------------
  const bar = input.barReference ?? wristHangBarReference(signals, rules);
  if (!bar) {
    return abstain(['bar_reference_unavailable'], {
      confidences: {
        landmarkVisibility: round3(meanVisibility),
        framing: round3(framingConfidence),
        repJudgment: 0,
      },
    });
  }
  const requiredClearance = Math.max(
    rules.chinClearanceFloor,
    rules.chinClearanceUncertaintyMultiple * bar.uncertainty,
  );

  // --- Attempt segmentation. --------------------------------------------------
  type Phase = 'seeking' | 'hang' | 'pull' | 'return';
  let phase: Phase = 'seeking';
  let hangFrames = 0;
  let attempt: Attempt | null = null;
  const attempts: Attempt[] = [];

  // Stretches where the machine was blind (no measurable elbow angle).
  // Attempts overlapping — or starting right after — such a gap cannot be
  // judged confidently: their true start, peak or lockout may be hidden.
  const OBSERVATION_GAP_MIN_MS = 500;
  const GAP_ADJACENCY_MS = 600;
  const observationGaps: { startMs: number; endMs: number }[] = [];
  let blindSince: number | null = null;

  const closeAttempt = (endMs: number) => {
    if (attempt) {
      attempt.endMs = endMs;
      attempts.push(attempt);
      attempt = null;
    }
  };

  for (const frame of signals) {
    // Every frame inside an attempt counts against its observability —
    // including frames where the athlete could not be measured at all. An
    // occluded stretch mid-rep must surface as uncertainty, not vanish.
    if (attempt) {
      attempt.visibilitySum += frame.coreVisibility;
      attempt.visibilityFrames += 1;
      if (frame.hipX !== null) {
        attempt.minHipX = attempt.minHipX === null ? frame.hipX : Math.min(attempt.minHipX, frame.hipX);
        attempt.maxHipX = attempt.maxHipX === null ? frame.hipX : Math.max(attempt.maxHipX, frame.hipX);
      }
      if (frame.torsoLength !== null) {
        attempt.torsoSum += frame.torsoLength;
        attempt.torsoFrames += 1;
      }
    }

    const angle = frame.minElbowAngleDeg;
    if (angle === null) {
      blindSince = blindSince ?? frame.tMs;
      diagnostics?.frames.push({
        tMs: frame.tMs,
        phase: 'blind',
        angleDeg: null,
        chinY: frame.chinY,
        hipX: frame.hipX,
        coreVisibility: round3(frame.coreVisibility),
      });
      continue;
    }
    if (blindSince !== null) {
      if (frame.tMs - blindSince >= OBSERVATION_GAP_MIN_MS) {
        observationGaps.push({ startMs: blindSince, endMs: frame.tMs });
      }
      blindSince = null;
    }

    switch (phase) {
      case 'seeking':
      case 'hang': {
        if (angle >= rules.hangAngleDeg) {
          hangFrames += 1;
          if (hangFrames >= rules.minHangFrames) {
            phase = 'hang';
          }
        } else if (phase === 'hang' && angle < rules.startPullAngleDeg) {
          attempt = newAttempt(frame.tMs, angle);
          phase = 'pull';
        } else if (angle < rules.hangAngleDeg) {
          hangFrames = 0;
        }
        break;
      }
      case 'pull': {
        if (!attempt) {
          phase = 'seeking';
          break;
        }
        attempt.bottomAngleDeg = Math.min(attempt.bottomAngleDeg, angle);
        if (frame.chinY !== null) {
          if (attempt.peakChinY === null || frame.chinY < attempt.peakChinY) {
            attempt.peakChinY = frame.chinY;
            attempt.chinVisibilityAtPeak = frame.chinVisibility;
          }
        }
        if (angle > attempt.bottomAngleDeg + RETURN_HYSTERESIS_DEG) {
          attempt.lockoutAngleDeg = angle;
          phase = 'return';
        }
        break;
      }
      case 'return': {
        if (!attempt) {
          phase = 'seeking';
          break;
        }
        attempt.lockoutAngleDeg = Math.max(attempt.lockoutAngleDeg, angle);
        if (angle >= rules.extensionAngleDeg) {
          // Lockout reached: the rep is complete.
          closeAttempt(frame.tMs);
          phase = 'hang';
          hangFrames = rules.minHangFrames;
        } else if (angle < attempt.lockoutAngleDeg - REDESCENT_HYSTERESIS_DEG) {
          // Re-descending without lockout: close this attempt, open the next.
          closeAttempt(frame.tMs);
          attempt = newAttempt(frame.tMs, angle);
          phase = 'pull';
        }
        break;
      }
    }

    diagnostics?.frames.push({
      tMs: frame.tMs,
      phase,
      angleDeg: Math.round(angle * 10) / 10,
      chinY: frame.chinY,
      hipX: frame.hipX,
      coreVisibility: round3(frame.coreVisibility),
    });
  }
  // Stream ended mid-attempt: it still happened, but it never completed —
  // it can be noted, never confidently failed (owner adjustment, M3C-1).
  if (attempt) {
    (attempt as Attempt).truncated = true;
  }
  closeAttempt(signals[signals.length - 1]!.tMs);
  if (diagnostics) {
    diagnostics.observationGaps.push(...observationGaps);
  }

  // --- Judge each attempt. ----------------------------------------------------
  const reps: RepRecord[] = [];
  let implausiblyFast = 0;
  let kippingFlagged = 0;

  attempts.forEach((item, index) => {
    const reasons: string[] = [];
    // Boxed so the helper closures' mutations survive TS narrowing.
    const judgment = { verdict: 'valid' as RepVerdict };
    const uncertain = (code: string) => {
      reasons.push(code);
      if (judgment.verdict === 'valid') {
        judgment.verdict = 'uncertain';
      }
    };
    const invalid = (code: string) => {
      reasons.push(code);
      judgment.verdict = 'invalid';
    };

    const meanRepVisibility =
      item.visibilityFrames > 0 ? item.visibilitySum / item.visibilityFrames : 0;
    const durationSeconds = (item.endMs - item.startMs) / 1000;
    const torso = item.torsoFrames > 0 ? item.torsoSum / item.torsoFrames : null;
    const hipSwing =
      item.minHipX !== null && item.maxHipX !== null && torso !== null && torso > 0
        ? (item.maxHipX - item.minHipX) / 2 / torso
        : 0;
    const clearance = item.peakChinY === null ? null : bar.lineY - item.peakChinY;

    // Chin over bar.
    if (clearance === null || item.chinVisibilityAtPeak < rules.repVisibilityFloor) {
      uncertain('landmarks_occluded');
    } else if (clearance >= requiredClearance) {
      // chin ok
    } else if (clearance <= -requiredClearance) {
      invalid('chin_below_bar');
    } else {
      uncertain('chin_clearance_uncertain');
    }

    // Return to extension.
    if (item.lockoutAngleDeg >= rules.extensionAngleDeg) {
      // lockout ok
    } else if (item.lockoutAngleDeg <= rules.extensionAngleDeg - rules.extensionUncertaintyDeg) {
      invalid('incomplete_extension');
    } else {
      uncertain('lockout_uncertain');
    }

    // Visibility across the rep.
    if (meanRepVisibility < rules.repVisibilityFloor && !reasons.includes('landmarks_occluded')) {
      uncertain('landmarks_occluded');
    }

    // Observation gaps: an attempt whose window touches (or starts right
    // after) a blind stretch may have its real start, peak or lockout
    // hidden — it cannot be judged confidently in either direction.
    const touchesGap = observationGaps.some(
      (gap) =>
        gap.startMs <= item.endMs + GAP_ADJACENCY_MS &&
        gap.endMs >= item.startMs - GAP_ADJACENCY_MS,
    );
    if (touchesGap) {
      uncertain('observation_gap');
    }

    // A trailing attempt cut off by the end of the stream never completed:
    // dropping off the bar mid-pull is not a confident failure (owner
    // adjustment, M3C-1 review).
    if (item.truncated) {
      uncertain('set_ended_mid_attempt');
    }

    // A partially observed or never-completed attempt cannot be confidently
    // judged in EITHER direction: hidden or unrecorded frames could contain
    // the clearance or lockout the visible ones lack. These downgrade
    // invalid findings to uncertainty — the reasons stay, the confidence
    // does not.
    if (
      judgment.verdict === 'invalid' &&
      (reasons.includes('observation_gap') ||
        reasons.includes('landmarks_occluded') ||
        reasons.includes('set_ended_mid_attempt'))
    ) {
      judgment.verdict = 'uncertain';
    }

    // Kipping: flag and (v1 policy) resolve to uncertain, never invalidate.
    if (hipSwing > rules.kippingAmplitudeTorsoUnits) {
      kippingFlagged += 1;
      if (rules.kippingPolicy === 'invalidate') {
        invalid('excessive_swing');
      } else {
        uncertain('excessive_swing');
      }
    }

    // Cadence.
    if (durationSeconds < rules.minRepSeconds) {
      implausiblyFast += 1;
      uncertain('implausible_cadence');
    }

    reps.push({
      repNumber: index + 1,
      startMs: item.startMs,
      endMs: item.endMs,
      verdict: judgment.verdict,
      reasonCodes: reasons,
      confidence: round3(meanRepVisibility * (judgment.verdict === 'uncertain' ? 0.5 : 1)),
      metrics: {
        chinClearance: clearance === null ? Number.NaN : round3(clearance),
        lockoutAngleDeg: Math.round(item.lockoutAngleDeg * 10) / 10,
        bottomAngleDeg: Math.round(item.bottomAngleDeg * 10) / 10,
        hipSwingAmplitude: round3(hipSwing),
        meanVisibility: round3(meanRepVisibility),
        durationSeconds: Math.round(durationSeconds * 100) / 100,
      },
    });
  });

  const detected = reps.length;
  const accepted = reps.filter((rep) => rep.verdict === 'valid').length;
  const uncertainCount = reps.filter((rep) => rep.verdict === 'uncertain').length;
  const invalidCount = reps.filter((rep) => rep.verdict === 'invalid').length;
  const repJudgment = detected > 0 ? (accepted + invalidCount) / detected : 0;

  if (kippingFlagged > 0) {
    anomalies.push({
      code: 'kipping_flagged',
      severity: 'info',
      detail: `${kippingFlagged} rep(s) showed hip swing beyond ${rules.kippingAmplitudeTorsoUnits} torso-units (v1 policy: flagged as uncertain, never auto-invalidated).`,
    });
  }
  if (implausiblyFast > 0) {
    anomalies.push({
      code: 'implausible_cadence',
      severity: 'suspicious',
      detail: `${implausiblyFast} rep(s) completed faster than ${rules.minRepSeconds}s.`,
    });
  }

  // --- Event recommendation. --------------------------------------------------
  const confidences = {
    landmarkVisibility: round3(meanVisibility),
    framing: round3(framingConfidence),
    repJudgment: round3(repJudgment),
  };
  const finish = (
    recommendation: CalisthenicsAnalysis['recommendation'],
    reasons: string[],
  ): CalisthenicsAnalysis => ({
    ...base,
    barReference: bar,
    recommendation,
    reasonCodes: reasons,
    anomalies,
    detectedReps: detected,
    acceptedReps: accepted,
    uncertainReps: uncertainCount,
    invalidReps: invalidCount,
    reps,
    elapsedMs,
    confidences,
  });

  if (detected === 0) {
    return finish('unable_to_verify', ['no_reps_detected']);
  }
  if (implausiblyFast >= rules.maxImplausibleCadenceReps) {
    return finish('unable_to_verify', ['implausible_cadence']);
  }
  if (uncertainCount / detected > rules.maxUncertainRepFraction) {
    return finish('unable_to_verify', ['rep_judgment_uncertain']);
  }
  if (
    accepted === 0 &&
    uncertainCount === 0 &&
    detected >= rules.minAttemptsForFailRecommendation
  ) {
    // Every attempt confidently judged, none valid: systematic violation.
    return finish('fail_candidate', ['no_valid_reps']);
  }
  return finish('pass_candidate', []);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
