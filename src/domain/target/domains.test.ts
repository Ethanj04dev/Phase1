import {
  DEMAND_LEVELS,
  demandRank,
  PREPARATION_DOMAIN_REGISTRY,
  PREPARATION_DOMAINS,
  preparationDomain,
  PROFICIENCY_LEVEL_SCORES,
  PROFICIENCY_LEVELS,
  proficiencyRank,
} from './domains';

describe('preparation domain registry', () => {
  it('describes every domain in the union', () => {
    for (const id of PREPARATION_DOMAINS) {
      const domain = preparationDomain(id);
      expect(domain.id).toBe(id);
      expect(domain.label.length).toBeGreaterThan(0);
      expect(domain.shortLabel.length).toBeGreaterThan(0);
      expect(domain.description.length).toBeGreaterThan(10);
    }
    expect(Object.keys(PREPARATION_DOMAIN_REGISTRY)).toHaveLength(
      PREPARATION_DOMAINS.length,
    );
  });

  it('gives every domain a short label that fits a dense row', () => {
    for (const id of PREPARATION_DOMAINS) {
      expect(preparationDomain(id).shortLabel.length).toBeLessThanOrEqual(5);
    }
  });

  // Water confidence is demonstrated, not timed. Scoring it on a stopwatch
  // would invent a precision that a skill assessment does not have.
  it('measures water confidence as proficiency rather than performance', () => {
    expect(preparationDomain('water_confidence').measurement).toBe('proficiency');
  });

  it('measures consistency and durability from behaviour, not from a test', () => {
    expect(preparationDomain('training_consistency').measurement).toBe('behavioural');
    expect(preparationDomain('durability').measurement).toBe('behavioural');
  });

  it('keeps swimming and water confidence as separate domains', () => {
    expect(PREPARATION_DOMAINS).toContain('swimming');
    expect(PREPARATION_DOMAINS).toContain('water_confidence');
    expect(preparationDomain('swimming').id).not.toBe(
      preparationDomain('water_confidence').id,
    );
  });
});

describe('demand levels', () => {
  it('is ordered so demands can be compared', () => {
    expect(demandRank('low')).toBeLessThan(demandRank('moderate'));
    expect(demandRank('moderate')).toBeLessThan(demandRank('high'));
    expect(demandRank('high')).toBeLessThan(demandRank('very_high'));
  });

  it('has no duplicate levels', () => {
    expect(new Set(DEMAND_LEVELS).size).toBe(DEMAND_LEVELS.length);
  });
});

describe('proficiency scale', () => {
  it('is ordered from not started to strong', () => {
    expect(proficiencyRank('not_started')).toBe(0);
    expect(proficiencyRank('strong')).toBe(PROFICIENCY_LEVELS.length - 1);
  });

  it('scores monotonically with the level', () => {
    let previous = -1;
    for (const level of PROFICIENCY_LEVELS) {
      const score = PROFICIENCY_LEVEL_SCORES[level];
      expect(score).toBeGreaterThan(previous);
      previous = score;
    }
  });

  it('bounds scores to the readiness range', () => {
    for (const level of PROFICIENCY_LEVELS) {
      expect(PROFICIENCY_LEVEL_SCORES[level]).toBeGreaterThanOrEqual(0);
      expect(PROFICIENCY_LEVEL_SCORES[level]).toBeLessThanOrEqual(100);
    }
  });

  it('gives no credit for a skill not started', () => {
    expect(PROFICIENCY_LEVEL_SCORES.not_started).toBe(0);
  });

  // Deliberately coarse: a finer scale would imply precision that a
  // self-reported skill assessment does not have.
  it('stays coarse', () => {
    expect(PROFICIENCY_LEVELS).toHaveLength(4);
  });
});
