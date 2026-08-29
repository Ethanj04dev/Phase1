import { findDomain, type TargetDefinition } from '@/domain/target/types';

import type { DayPlan, SessionPlan, TrackPlan, WeekPlan } from './buildProgram';
import { easyRuckSession, easyRunSession } from './sessions';

/**
 * Target-aware programme adaptation.
 *
 * The tracks were authored before Targets existed and they all swim. That was
 * an incoherence: the product tells a Ranger athlete they are never scored on
 * water, lists no water demand for their career, and then prescribed a pool
 * session on Tuesday. An instrument that contradicts itself is not an
 * instrument.
 *
 * For a Target with no swimming domain, every swim session is replaced by an
 * easy aerobic run of the same duration. Aerobic-for-aerobic on purpose: the
 * swap must not quietly spike load-bearing volume, and easy running is the
 * most conservative substitute for the same training intent. The swap is
 * named on the programme so the athlete knows it happened.
 *
 * Careers without a full Target definition keep the original programme:
 * with no domain model there is no basis to adapt on, and guessing is worse
 * than the default.
 */

/** Metres of easy running per minute, roughly a conversational 10:00 mile. */
const EASY_RUN_METERS_PER_MINUTE = 160;

/** Metres of easy rucking per minute, roughly a 15:30 mile under light load. */
const EASY_RUCK_METERS_PER_MINUTE = 105;

/** Substitute-ruck load, deliberately below the 35lb assessment standard. */
const EASY_RUCK_POUNDS = 25;

/**
 * How swims are replaced, decided by what the Target leans on hardest.
 *
 * For most land careers the swap is easy running: aerobic-for-aerobic, no
 * added strain. Where rucking is the heaviest-weighted domain, one swim slot
 * per week becomes an easy ruck instead -- lighter load than the assessment
 * standard, meaningfully slower than assessed pace -- because for that
 * career, time under the straps is the training intent the swim slot should
 * serve. One per week, never more: this is a deliberate substitution, not a
 * quiet spike in load-bearing volume.
 */
type SubstitutionStrategy = 'run_only' | 'ruck_forward';

function strategyFor(target: TargetDefinition): SubstitutionStrategy {
  const heaviest = [...target.domains].sort((a, b) => b.weight - a.weight)[0];
  return heaviest?.id === 'rucking' ? 'ruck_forward' : 'run_only';
}

function roundTo100(meters: number): number {
  return Math.max(100, Math.round(meters / 100) * 100);
}

function runSubstitute(swim: SessionPlan): SessionPlan {
  return easyRunSession(
    roundTo100(swim.estimatedMinutes * EASY_RUN_METERS_PER_MINUTE),
    swim.estimatedMinutes,
  );
}

function ruckSubstitute(swim: SessionPlan): SessionPlan {
  return easyRuckSession(
    roundTo100(swim.estimatedMinutes * EASY_RUCK_METERS_PER_MINUTE),
    EASY_RUCK_POUNDS,
    swim.estimatedMinutes,
  );
}

function adaptDay(day: DayPlan, substitute: (swim: SessionPlan) => SessionPlan): DayPlan {
  const sessions = day.sessions ?? [];
  if (!sessions.some((session) => session.modality === 'swimming')) {
    return day;
  }

  const adapted = sessions.map((session) =>
    session.modality === 'swimming' ? substitute(session) : session,
  );

  return {
    ...day,
    // The authored title named the swim; rebuild it from what the day now
    // actually contains rather than leaving a label that lies.
    title: adapted.map((session) => session.title).join(' + '),
    description:
      'Adapted for a land-focused target: easy aerobic work on foot replaces the swim at the same duration.',
    sessions: adapted,
  };
}

function adaptWeek(week: WeekPlan, strategy: SubstitutionStrategy): WeekPlan {
  // The one-per-week budget for the ruck substitute. Spent on the first swim
  // slot of the week; every later swim that week becomes a run.
  let ruckBudget = strategy === 'ruck_forward' ? 1 : 0;

  const days = week.days.map((day) => {
    const hasSwim = (day.sessions ?? []).some((session) => session.modality === 'swimming');
    if (hasSwim && ruckBudget > 0) {
      ruckBudget -= 1;
      return adaptDay(day, ruckSubstitute);
    }
    return adaptDay(day, runSubstitute);
  });

  return { ...week, days };
}

/** True when this athlete's programme should keep its swim sessions. */
export function planKeepsSwimming(target: TargetDefinition | undefined): boolean {
  // No Target definition means no domain model to adapt on; the original
  // programme stands.
  return target === undefined || findDomain(target, 'swimming') !== undefined;
}

export function adaptPlanForTarget(
  plan: TrackPlan,
  target: TargetDefinition | undefined,
): TrackPlan {
  if (planKeepsSwimming(target) || target === undefined) {
    // Same reference, not a copy: callers and tests can tell "unchanged"
    // from "rebuilt identically".
    return plan;
  }

  const strategy = strategyFor(target);

  return {
    ...plan,
    description: `${plan.description} Adapted for a land-focused target: swims are replaced with easy aerobic work on foot.`,
    weeks: plan.weeks.map((week) => adaptWeek(week, strategy)),
  };
}
