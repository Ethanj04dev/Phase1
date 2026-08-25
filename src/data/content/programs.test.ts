import { TRAINING_TRACKS } from '@/domain/athlete/types';
import { MODALITY_CATEGORY } from '@/domain/training/types';

import { dayKey } from './buildProgram';
import { ALL_PROGRAMS, programForTrack } from './programs';

/**
 * Structural guarantees for authored content. These are the invariants the UI
 * and the scheduler assume; a template that quietly stops satisfying one would
 * otherwise surface as a blank screen.
 */

describe('programme catalog', () => {
  it('authors a programme for every training track', () => {
    for (const track of TRAINING_TRACKS) {
      expect(() => programForTrack(track.id)).not.toThrow();
    }
    expect(ALL_PROGRAMS).toHaveLength(TRAINING_TRACKS.length);
  });

  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s has a full eight week block',
    (_trackId, built) => {
      expect(built.program.durationWeeks).toBe(8);
      expect(built.weeks).toHaveLength(8);
    },
  );

  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s has seven days in every week',
    (_trackId, built) => {
      for (let week = 1; week <= built.program.durationWeeks; week += 1) {
        for (let day = 1; day <= 7; day += 1) {
          expect(built.days.get(dayKey(week, day))).toBeDefined();
        }
      }
      expect(built.days.size).toBe(built.program.durationWeeks * 7);
    },
  );

  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s gives every day, session and block a unique id',
    (_trackId, built) => {
      const ids = new Set<string>();
      for (const day of built.days.values()) {
        expect(ids.has(day.id)).toBe(false);
        ids.add(day.id);
        for (const session of day.sessions) {
          expect(ids.has(session.id)).toBe(false);
          ids.add(session.id);
          for (const block of session.blocks) {
            expect(ids.has(block.id)).toBe(false);
            ids.add(block.id);
          }
        }
      }
      expect(ids.size).toBeGreaterThan(0);
    },
  );

  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s marks rest days consistently',
    (_trackId, built) => {
      for (const day of built.days.values()) {
        expect(day.restDay).toBe(day.sessions.length === 0);
      }
    },
  );

  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s includes at least one full rest day every week',
    (_trackId, built) => {
      for (let week = 1; week <= built.program.durationWeeks; week += 1) {
        const restDays = Array.from({ length: 7 }, (_, i) =>
          built.days.get(dayKey(week, i + 1)),
        ).filter((day) => day?.restDay);
        expect(restDays.length).toBeGreaterThanOrEqual(1);
      }
    },
  );

  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s never prescribes a zero or negative distance',
    (_trackId, built) => {
      for (const day of built.days.values()) {
        for (const session of day.sessions) {
          for (const block of session.blocks) {
            if ('distanceMeters' in block && block.distanceMeters !== undefined) {
              expect(block.distanceMeters).toBeGreaterThan(0);
            }
            if ('reps' in block && typeof block.reps === 'number') {
              expect(block.reps).toBeGreaterThan(0);
            }
          }
        }
      }
    },
  );

  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s deloads every fourth week',
    (_trackId, built) => {
      const deloadFocus = built.weekFocus.get(4);
      expect(deloadFocus).toBe('Recovery and technique');
      expect(built.weekFocus.get(8)).toBe('Recovery and technique');
      expect(built.weekFocus.get(3)).not.toBe('Recovery and technique');
    },
  );
});

describe('progressive overload', () => {
  it.each(ALL_PROGRAMS.map((p) => [p.program.trackId, p] as const))(
    '%s increases weekly running volume across a build block',
    (_trackId, built) => {
      const runningMeters = (week: number): number => {
        let total = 0;
        for (let day = 1; day <= 7; day += 1) {
          const entry = built.days.get(dayKey(week, day));
          for (const session of entry?.sessions ?? []) {
            if (MODALITY_CATEGORY[session.modality] !== 'running') continue;
            for (const block of session.blocks) {
              if ('distanceMeters' in block && block.distanceMeters) {
                total += block.distanceMeters;
              }
            }
          }
        }
        return total;
      };

      expect(runningMeters(3)).toBeGreaterThan(runningMeters(1));
      // The deload must actually back off, not just change its label.
      expect(runningMeters(4)).toBeLessThan(runningMeters(3));
    },
  );

  it('scales load and volume up across the three tracks', () => {
    const ruckLoad = (trackId: 'foundation' | 'selection_prep' | 'advanced'): number => {
      const built = programForTrack(trackId);
      for (const day of built.days.values()) {
        for (const session of day.sessions) {
          for (const block of session.blocks) {
            if (block.kind === 'ruck') return block.loadPounds;
          }
        }
      }
      return 0;
    };

    expect(ruckLoad('foundation')).toBeLessThan(ruckLoad('selection_prep'));
    expect(ruckLoad('selection_prep')).toBeLessThan(ruckLoad('advanced'));
  });

  it('prescribes faster interval targets on the advanced track', () => {
    const intervalFactor = (
      trackId: 'selection_prep' | 'advanced',
    ): number | undefined => {
      const built = programForTrack(trackId);
      for (const day of built.days.values()) {
        for (const session of day.sessions) {
          for (const block of session.blocks) {
            if (block.kind === 'interval') return block.target.factor;
          }
        }
      }
      return undefined;
    };

    expect(intervalFactor('advanced')).toBeLessThan(intervalFactor('selection_prep')!);
  });
});
