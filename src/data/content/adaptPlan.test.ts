import { RUCK_ASSESSMENT_LOAD_POUNDS } from '@/domain/assessment/types';
import type { ResolvedWorkoutDay } from '@/domain/training/types';

import { programForAthlete, programForTrack } from './programs';

function allDays(program: ReturnType<typeof programForTrack>): ResolvedWorkoutDay[] {
  return [...program.days.values()];
}

describe('target-aware programme adaptation', () => {
  const base = programForTrack('selection_prep');
  const ranger = programForAthlete('selection_prep', 'army_ranger');
  const pj = programForAthlete('selection_prep', 'pararescue');
  const seal = programForAthlete('selection_prep', 'navy_seal');

  // The incoherence this exists to close: the product tells a Ranger athlete
  // they are never scored on water, then prescribed a pool session.
  it('gives a no-water target a programme with no swim sessions anywhere', () => {
    for (const day of allDays(ranger)) {
      for (const session of day.sessions) {
        expect(session.modality).not.toBe('swimming');
      }
    }
  });

  it('leaves water careers on the authored programme, by reference', () => {
    expect(pj).toBe(base);
    expect(seal).toBe(base);
  });

  it('leaves careers without a target definition on the authored programme', () => {
    // No domain model means no basis to adapt on; guessing is worse than the
    // default.
    expect(programForAthlete('selection_prep', 'swcc')).toBe(base);
  });

  it('changes what the sessions are, not how much training there is', () => {
    const baseDays = allDays(base);
    const rangerDays = allDays(ranger);
    expect(rangerDays.length).toBe(baseDays.length);

    for (let index = 0; index < baseDays.length; index += 1) {
      const original = baseDays[index];
      const adapted = rangerDays[index];
      if (!original || !adapted) continue;
      // Same number of sessions, and the same minutes in each slot: the swap
      // must not quietly shrink or inflate the week.
      expect(adapted.sessions.length).toBe(original.sessions.length);
      for (let s = 0; s < original.sessions.length; s += 1) {
        expect(adapted.sessions[s]?.estimatedMinutes).toBe(
          original.sessions[s]?.estimatedMinutes,
        );
      }
    }
  });

  // Ranger's heaviest domain is rucking, so its substitution is ruck-forward:
  // one swim slot per week becomes an easy ruck, the rest become runs. The
  // budget is the contract -- a deliberate substitution, never a quiet spike
  // in load-bearing volume.
  it('spends at most one ruck substitute per week, and runs for the rest', () => {
    for (const [key, adapted] of ranger.days.entries()) {
      const original = base.days.get(key);
      if (!original) continue;
      let rucksAdded = 0;
      for (let s = 0; s < original.sessions.length; s += 1) {
        const from = original.sessions[s]?.modality;
        const to = adapted.sessions[s]?.modality;
        if (from === 'swimming') {
          expect(['running', 'rucking']).toContain(to);
          if (to === 'rucking') rucksAdded += 1;
        } else {
          expect(to).toBe(from);
        }
      }
      // Per-day check; the weekly budget is asserted below.
      expect(rucksAdded).toBeLessThanOrEqual(1);
    }

    // Weekly budget: group by week number from the day key.
    const addedPerWeek = new Map<string, number>();
    for (const [key, adapted] of ranger.days.entries()) {
      const original = base.days.get(key);
      if (!original) continue;
      const week = key.split(':')[0] ?? '';
      for (let s = 0; s < original.sessions.length; s += 1) {
        if (
          original.sessions[s]?.modality === 'swimming' &&
          adapted.sessions[s]?.modality === 'rucking'
        ) {
          addedPerWeek.set(week, (addedPerWeek.get(week) ?? 0) + 1);
        }
      }
    }
    expect(addedPerWeek.size).toBeGreaterThan(0);
    for (const count of addedPerWeek.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it('keeps every substituted ruck below the assessment load and off assessed pace', () => {
    for (const [key, adapted] of ranger.days.entries()) {
      const original = base.days.get(key);
      if (!original) continue;
      for (let s = 0; s < original.sessions.length; s += 1) {
        if (
          original.sessions[s]?.modality === 'swimming' &&
          adapted.sessions[s]?.modality === 'rucking'
        ) {
          for (const block of adapted.sessions[s]?.blocks ?? []) {
            if (block.kind !== 'ruck') continue;
            expect(block.loadPounds).toBeLessThan(RUCK_ASSESSMENT_LOAD_POUNDS);
            // Eased pace: meaningfully slower than the assessed ruck pace.
            expect(block.target?.factor ?? 1).toBeGreaterThan(1.05);
          }
        }
      }
    }
  });

  it('rewrites the titles of days it changed rather than leaving labels that lie', () => {
    const baseDays = allDays(base);
    const rangerDays = allDays(ranger);
    for (let index = 0; index < baseDays.length; index += 1) {
      const original = baseDays[index];
      const adapted = rangerDays[index];
      if (!original || !adapted) continue;
      const hadSwim = original.sessions.some((session) => session.modality === 'swimming');
      if (hadSwim) {
        expect(adapted.title.toLowerCase()).not.toContain('swim');
        expect(adapted.title.toLowerCase()).not.toContain('pool');
      } else {
        expect(adapted.title).toBe(original.title);
      }
    }
  });

  it('says on the programme that the adaptation happened', () => {
    expect(ranger.program.description.toLowerCase()).toContain('adapted');
    expect(base.program.description.toLowerCase()).not.toContain('adapted');
  });

  it('keeps day ids stable across the variants', () => {
    // A workout logged before a goal change must still match its day.
    const baseIds = allDays(base).map((day) => day.id);
    const rangerIds = allDays(ranger).map((day) => day.id);
    expect(rangerIds).toEqual(baseIds);
  });

  it('adapts every track, not just the primary one', () => {
    for (const trackId of ['foundation', 'advanced'] as const) {
      const adapted = programForAthlete(trackId, 'army_ranger');
      for (const day of allDays(adapted)) {
        for (const session of day.sessions) {
          expect(session.modality).not.toBe('swimming');
        }
      }
    }
  });
});
