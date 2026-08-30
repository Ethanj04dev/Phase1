import { findState, isStateCode, US_STATES } from './states';
import { PUBLIC_CANDIDATE_FIELDS } from './types';

describe('US_STATES', () => {
  it('covers the fifty states plus DC', () => {
    expect(US_STATES).toHaveLength(51);
  });

  it('uses unique two-letter codes', () => {
    const codes = US_STATES.map((state) => state.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('looks up by code', () => {
    expect(findState('FL')?.name).toBe('Florida');
    expect(findState('XX')).toBeUndefined();
    expect(isStateCode('TX')).toBe(true);
    expect(isStateCode('ZZ')).toBe(false);
  });
});

describe('PUBLIC_CANDIDATE_FIELDS', () => {
  /**
   * Pins exactly what other users may ever see of a candidate. Widening this
   * list is a privacy decision, not a refactor: this test failing is the
   * point at which that conversation happens.
   */
  it('exposes only the agreed public identity fields', () => {
    expect([...PUBLIC_CANDIDATE_FIELDS].sort()).toEqual(
      ['createdAt', 'displayHandle', 'displayName', 'handle', 'id', 'pipelineId', 'stateCode'].sort(),
    );
  });

  it('never exposes account or private fields', () => {
    const forbidden = ['userId', 'visibility', 'bio', 'avatarUrl', 'updatedAt'];
    for (const field of forbidden) {
      expect(PUBLIC_CANDIDATE_FIELDS).not.toContain(field);
    }
  });
});
