import {
  PHASE1_TARGET_READINESS,
  READINESS_BAND_DESCRIPTIONS,
  READINESS_BAND_LABELS,
  READINESS_BANDS,
  readinessBand,
} from './bands';

describe('readinessBand', () => {
  it('reads the bottom of the range as early', () => {
    expect(readinessBand(0)).toBe('early');
    expect(readinessBand(39)).toBe('early');
  });

  it('moves up through the bands', () => {
    expect(readinessBand(40)).toBe('building');
    expect(readinessBand(59)).toBe('building');
    expect(readinessBand(60)).toBe('developing');
    expect(readinessBand(79)).toBe('developing');
    expect(readinessBand(80)).toBe('prepared');
    expect(readinessBand(100)).toBe('prepared');
  });

  it('never decreases as the score rises', () => {
    let previous = -1;
    for (let score = 0; score <= 100; score += 1) {
      const rank = READINESS_BANDS.indexOf(readinessBand(score));
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it('clamps out-of-range and unusable input', () => {
    expect(readinessBand(-20)).toBe('early');
    expect(readinessBand(140)).toBe('prepared');
    expect(readinessBand(Number.NaN)).toBe('early');
  });

  it('describes and labels every band', () => {
    for (const band of READINESS_BANDS) {
      expect(READINESS_BAND_LABELS[band].length).toBeGreaterThan(0);
      expect(READINESS_BAND_DESCRIPTIONS[band].length).toBeGreaterThan(20);
    }
  });

  // The band is a reading of preparation, never a forecast of outcome.
  it('describes preparation without predicting selection', () => {
    const text = Object.values(READINESS_BAND_DESCRIPTIONS).join(' ').toLowerCase();
    expect(text).not.toMatch(/will pass|guarantee|selected|you will/);
  });

  it('puts the Phase 1 target inside the prepared band', () => {
    expect(readinessBand(PHASE1_TARGET_READINESS)).toBe('prepared');
  });
});
