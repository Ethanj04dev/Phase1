import { branding, RATING_LABEL } from './branding';

describe('branding', () => {
  it('carries the Zero Phase identity', () => {
    expect(branding.productName).toBe('ZERO PHASE');
    expect(`${branding.wordmark.lead} ${branding.wordmark.numeral}`).toBe('ZERO PHASE');
  });

  // The rating deliberately has no brand name yet. This test exists so that
  // when it gets one, the change is a decision made here, not a placeholder
  // that leaked into production copy.
  it('labels the competitive rating generically until it is named', () => {
    expect(RATING_LABEL).toBe('Performance rating');
  });
});
