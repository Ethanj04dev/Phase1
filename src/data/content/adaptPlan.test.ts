import { programForAthlete, programForTrack } from './programs';
import type { ResolvedWorkoutDay } from '@/domain/training/types';

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

  it('substitutes aerobic for aerobic, never adding load-bearing volume', () => {
    const baseDays = allDays(base);
    const rangerDays = allDays(ranger);
    for (let index = 0; index < baseDays.length; index += 1) {
      const original = baseDays[index];
      const adapted = rangerDays[index];
      if (!original || !adapted) continue;
      for (let s = 0; s < original.sessions.length; s += 1) {
        if (original.sessions[s]?.modality === 'swimming') {
          expect(adapted.sessions[s]?.modality).toBe('running');
        } else {
          expect(adapted.sessions[s]?.modality).toBe(original.sessions[s]?.modality);
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
