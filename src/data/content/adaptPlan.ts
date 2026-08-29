import { findDomain, type TargetDefinition } from '@/domain/target/types';

import type { DayPlan, SessionPlan, TrackPlan, WeekPlan } from './buildProgram';
import { easyRunSession } from './sessions';

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

function landSubstitute(swim: SessionPlan): SessionPlan {
  const meters =
    Math.max(16, Math.round((swim.estimatedMinutes * EASY_RUN_METERS_PER_MINUTE) / 100)) * 100;
  return easyRunSession(meters, swim.estimatedMinutes);
}

function adaptDay(day: DayPlan): DayPlan {
  const sessions = day.sessions ?? [];
  if (!sessions.some((session) => session.modality === 'swimming')) {
    return day;
  }

  const adapted = sessions.map((session) =>
    session.modality === 'swimming' ? landSubstitute(session) : session,
  );

  return {
    ...day,
    // The authored title named the swim; rebuild it from what the day now
    // actually contains rather than leaving a label that lies.
    title: adapted.map((session) => session.title).join(' + '),
    description:
      'Adapted for a land-focused target: easy aerobic running replaces the swim at the same duration.',
    sessions: adapted,
  };
}

function adaptWeek(week: WeekPlan): WeekPlan {
  return { ...week, days: week.days.map(adaptDay) };
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
  if (planKeepsSwimming(target)) {
    // Same reference, not a copy: callers and tests can tell "unchanged"
    // from "rebuilt identically".
    return plan;
  }

  return {
    ...plan,
    description: `${plan.description} Adapted for a land-focused target: swims are replaced with easy aerobic running.`,
    weeks: plan.weeks.map(adaptWeek),
  };
}
