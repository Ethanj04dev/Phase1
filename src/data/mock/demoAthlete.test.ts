import { getGoalOrDefault } from '@/domain/goals/catalog';
import { calculateReadiness, calculateTrend } from '@/domain/readiness/score';
import type { ReadinessSnapshot } from '@/domain/readiness/types';

import {
  demoAssessmentDates,
  demoAssessmentResults,
  demoNow,
  demoProfile,
} from './demoAthlete';

/**
 * Guards the demo athlete against drifting into nonsense.
 *
 * The demo data is what every screen is designed against, so if it stops
 * describing a plausible athlete the whole UI gets tuned for the wrong numbers.
 */
const goal = getGoalOrDefault(demoProfile.goalId);

function historyToDate(): ReadinessSnapshot[] {
  return demoAssessmentDates.flatMap((date) => {
    const calculation = calculateReadiness(
      goal,
      demoAssessmentResults.filter((result) => result.recordedAt <= date),
    );
    return calculation
      ? [{ ...calculation, id: date, athleteId: demoProfile.id, recordedAt: date }]
      : [];
  });
}

describe('demo athlete', () => {
  it('scores every category that has an assessment event', () => {
    const calculation = calculateReadiness(goal, demoAssessmentResults);
    expect(calculation).not.toBeNull();
    expect(calculation?.categories.running).toBeDefined();
    expect(calculation?.categories.swimming).toBeDefined();
    expect(calculation?.categories.calisthenics).toBeDefined();
    expect(calculation?.categories.rucking).toBeDefined();
    // No strength assessment exists yet, so the category stays absent rather
    // than being invented. See docs/ROADMAP.md, M3.
    expect(calculation?.categories.strength).toBeUndefined();
  });

  it('describes a mid-preparation athlete, not a beginner or a finished one', () => {
    const overall = calculateReadiness(goal, demoAssessmentResults)?.overall ?? 0;
    expect(overall).toBeGreaterThan(45);
    expect(overall).toBeLessThan(85);
  });

  it('surfaces swimming as the priority for a Pararescue goal', () => {
    // The demo athlete is deliberately a weak swimmer chasing a swim-heavy
    // pipeline. If this stops holding, the dashboard is demonstrating nothing.
    const calculation = calculateReadiness(goal, demoAssessmentResults);
    expect(calculation?.priorityCategory).toBe('swimming');
  });

  it('improves across all three rounds of testing', () => {
    const history = historyToDate();
    expect(history).toHaveLength(3);
    for (let i = 1; i < history.length; i += 1) {
      const previous = history[i - 1];
      const current = history[i];
      if (!previous || !current) continue;
      expect(current.overall).toBeGreaterThan(previous.overall);
    }
  });

  it('shows a positive 30 day trend', () => {
    const trend = calculateTrend(historyToDate(), 30, demoNow);
    expect(trend).not.toBeNull();
    expect(trend?.delta).toBeGreaterThan(0);
  });
});
