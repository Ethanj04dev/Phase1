import { PARARESCUE } from '@/data/content/pipelines';

import type { ProficiencyLevel } from './domains';
import {
  currentLevels,
  latestRatingBySkill,
  meetsTarget,
  ratedCount,
  skillStandings,
  supervisedSkills,
  type ProficiencyRating,
} from './proficiency';
import { findDomain } from './types';

const WATER = findDomain(PARARESCUE, 'water_confidence');

let counter = 0;
function rating(
  skillId: string,
  level: ProficiencyLevel,
  recordedAt: string,
): ProficiencyRating {
  counter += 1;
  return {
    id: `p${counter}`,
    athleteId: 'a',
    domainId: 'water_confidence',
    skillId,
    level,
    recordedAt,
    notes: null,
  };
}

describe('rating history', () => {
  const HISTORY: readonly ProficiencyRating[] = [
    rating('treading', 'developing', '2026-03-01T00:00:00.000Z'),
    rating('treading', 'competent', '2026-07-01T00:00:00.000Z'),
    rating('fin_swimming', 'developing', '2026-05-01T00:00:00.000Z'),
  ];

  it('keeps the newest rating per skill', () => {
    const latest = latestRatingBySkill(HISTORY);
    expect(latest.get('treading')?.level).toBe('competent');
    expect(latest.get('fin_swimming')?.level).toBe('developing');
  });

  // Newest, not best. A skill can genuinely go backwards.
  it('lets a skill regress rather than remembering a personal best', () => {
    const regressed = [...HISTORY, rating('treading', 'developing', '2026-08-01T00:00:00.000Z')];
    expect(latestRatingBySkill(regressed).get('treading')?.level).toBe('developing');
  });

  it('is insensitive to the order it is given', () => {
    const reversed = [...HISTORY].reverse();
    expect(currentLevels(reversed)).toEqual(currentLevels(HISTORY));
  });

  it('produces the map the readiness engine consumes', () => {
    expect(currentLevels(HISTORY)).toEqual({
      treading: 'competent',
      fin_swimming: 'developing',
    });
  });
});

describe('standings', () => {
  it('covers every skill the domain defines', () => {
    const standings = skillStandings(WATER!, []);
    expect(standings).toHaveLength(WATER?.proficiencySkills?.length ?? 0);
  });

  // The distinction the whole type exists to preserve.
  it('separates never rated from rated as not started', () => {
    const standings = skillStandings(WATER!, [
      rating('treading', 'not_started', '2026-03-01T00:00:00.000Z'),
    ]);
    const treading = standings.find((s) => s.skill.id === 'treading');
    const fins = standings.find((s) => s.skill.id === 'fin_swimming');

    expect(treading?.level).toBe('not_started');
    expect(fins?.level).toBeNull();
  });

  it('counts what has been rated, not what has been passed', () => {
    const standings = skillStandings(WATER!, [
      rating('treading', 'not_started', '2026-03-01T00:00:00.000Z'),
    ]);
    expect(ratedCount(standings)).toEqual({ rated: 1, total: standings.length });
  });

  it('reports whether the suggested level has been reached', () => {
    const standings = skillStandings(WATER!, [
      rating('treading', 'competent', '2026-03-01T00:00:00.000Z'),
      rating('fin_swimming', 'developing', '2026-03-01T00:00:00.000Z'),
    ]);
    expect(standings.find((s) => s.skill.id === 'treading')?.met).toBe(true);
    expect(standings.find((s) => s.skill.id === 'fin_swimming')?.met).toBe(false);
  });

  it('does not count an unrated skill as met', () => {
    for (const standing of skillStandings(WATER!, [])) {
      expect(standing.met).toBe(false);
    }
  });
});

describe('target levels', () => {
  it('treats exceeding the suggested level as meeting it', () => {
    const treading = WATER?.proficiencySkills?.find((s) => s.id === 'treading');
    expect(meetsTarget(treading!, 'strong')).toBe(true);
    expect(meetsTarget(treading!, 'competent')).toBe(true);
    expect(meetsTarget(treading!, 'developing')).toBe(false);
  });
});

describe('supervision', () => {
  // A screen that forgets to filter for this is a screen that lets someone
  // practise underwater work alone.
  it('names underwater work as requiring supervision', () => {
    const ids = supervisedSkills(WATER!).map((skill) => skill.id);
    expect(ids).toContain('underwater_comfort');
  });

  it('gives every supervised skill a notice that says never and blackout', () => {
    for (const skill of supervisedSkills(WATER!)) {
      const notice = (skill.safetyNotice ?? '').toLowerCase();
      expect(notice).toContain('never');
      expect(notice).toContain('blackout');
    }
  });
});
