import { PHASES, phaseForReadiness } from './branding';

describe('phaseForReadiness', () => {
  it('returns the foundation phase at the bottom of the range', () => {
    expect(phaseForReadiness(0).id).toBe(1);
    expect(phaseForReadiness(54).id).toBe(1);
  });

  it('returns the highest band the score satisfies', () => {
    expect(phaseForReadiness(55).id).toBe(2);
    expect(phaseForReadiness(74).id).toBe(2);
    expect(phaseForReadiness(75).id).toBe(3);
    expect(phaseForReadiness(89).id).toBe(3);
    expect(phaseForReadiness(90).id).toBe(4);
    expect(phaseForReadiness(100).id).toBe(4);
  });
});

describe('PHASES', () => {
  it('starts at zero so every score maps to a phase', () => {
    expect(PHASES[0]?.minReadiness).toBe(0);
  });

  it('is ordered by ascending threshold', () => {
    const thresholds = PHASES.map((phase) => phase.minReadiness);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
  });
});
