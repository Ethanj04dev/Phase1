import { PARARESCUE } from '@/data/content/pipelines';

import {
  milestoneProgress,
  milestoneStandings,
  suggestedNextMilestone,
  type MilestoneCompletion,
} from './milestones';

let counter = 0;
function completion(milestoneId: string, completedAt: string): MilestoneCompletion {
  counter += 1;
  return { id: `m${counter}`, athleteId: 'a', milestoneId, completedAt };
}

describe('standings', () => {
  it('covers every milestone the target defines', () => {
    expect(milestoneStandings(PARARESCUE, [])).toHaveLength(PARARESCUE.milestones.length);
  });

  it('lists them in suggested order regardless of input order', () => {
    const orders = milestoneStandings(PARARESCUE, []).map((s) => s.milestone.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('marks a completed milestone with when it was recorded', () => {
    const standings = milestoneStandings(PARARESCUE, [
      completion('asvab_completed', '2026-05-01T00:00:00.000Z'),
    ]);
    const asvab = standings.find((s) => s.milestone.id === 'asvab_completed');
    expect(asvab?.completedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('leaves everything else unmarked', () => {
    const standings = milestoneStandings(PARARESCUE, [
      completion('asvab_completed', '2026-05-01T00:00:00.000Z'),
    ]);
    for (const standing of standings) {
      if (standing.milestone.id !== 'asvab_completed') {
        expect(standing.completedAt).toBeNull();
      }
    }
  });

  it('keeps the newest record when a step was undone and redone', () => {
    const standings = milestoneStandings(PARARESCUE, [
      completion('asvab_completed', '2026-05-01T00:00:00.000Z'),
      completion('asvab_completed', '2026-07-01T00:00:00.000Z'),
    ]);
    expect(
      standings.find((s) => s.milestone.id === 'asvab_completed')?.completedAt,
    ).toBe('2026-07-01T00:00:00.000Z');
  });

  it('ignores a completion for a milestone this pipeline does not define', () => {
    const standings = milestoneStandings(PARARESCUE, [
      completion('some_other_career_step', '2026-05-01T00:00:00.000Z'),
    ]);
    expect(standings).toHaveLength(PARARESCUE.milestones.length);
    expect(standings.every((s) => s.completedAt === null)).toBe(true);
  });

  // Completed steps hold their place. A list that reorders itself as you walk
  // it is harder to read, not easier.
  it('does not move completed milestones to the end', () => {
    const first = PARARESCUE.milestones.find((m) => m.order === 1);
    const standings = milestoneStandings(PARARESCUE, [
      completion(first?.id ?? '', '2026-05-01T00:00:00.000Z'),
    ]);
    expect(standings[0]?.milestone.id).toBe(first?.id);
  });
});

describe('progress', () => {
  it('counts nothing on a fresh athlete', () => {
    expect(milestoneProgress(milestoneStandings(PARARESCUE, []))).toEqual({
      completed: 0,
      total: PARARESCUE.milestones.length,
    });
  });

  it('counts what has been marked done', () => {
    const standings = milestoneStandings(PARARESCUE, [
      completion('recruiter_contacted', '2026-04-01T00:00:00.000Z'),
      completion('asvab_completed', '2026-05-01T00:00:00.000Z'),
    ]);
    expect(milestoneProgress(standings).completed).toBe(2);
  });
});

describe('suggested next', () => {
  it('is the first step on a fresh athlete', () => {
    const standings = milestoneStandings(PARARESCUE, []);
    expect(suggestedNextMilestone(standings)?.order).toBe(1);
  });

  // Nothing here is a gate. Steps get done out of order in real life.
  it('suggests an earlier gap even when a later step is already done', () => {
    const standings = milestoneStandings(PARARESCUE, [
      completion('ship_date', '2026-08-01T00:00:00.000Z'),
    ]);
    expect(suggestedNextMilestone(standings)?.order).toBe(1);
  });

  it('is null once everything is marked done', () => {
    const standings = milestoneStandings(
      PARARESCUE,
      PARARESCUE.milestones.map((m) => completion(m.id, '2026-08-01T00:00:00.000Z')),
    );
    expect(suggestedNextMilestone(standings)).toBeNull();
  });
});
