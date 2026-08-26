import {
  isSourceStale,
  isVerified,
  SOURCE_REVIEW_INTERVAL_DAYS,
  unverified,
  verified,
  verifiedValue,
  type Source,
} from './provenance';

/**
 * These tests guard the product's most important promise: that Phase 1 never
 * presents its own recommendation, or a placeholder, as an official military
 * requirement.
 */

describe('verified values', () => {
  it('exposes a value only through the verified branch', () => {
    const value = verified(568, 'src-1');
    expect(isVerified(value)).toBe(true);
    expect(verifiedValue(value)).toBe(568);
  });

  // The point of the whole type. An unverified standard carries no number, so
  // there is nothing a screen can render even by mistake.
  it('carries no value at all when unverified', () => {
    const value = unverified<number>('not yet sourced');
    expect(isVerified(value)).toBe(false);
    expect(verifiedValue(value)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(value, 'value')).toBe(false);
  });

  it('keeps the developer reason out of the value channel', () => {
    const value = unverified<number>('waiting on the published table');
    expect(verifiedValue(value)).toBeNull();
    if (value.status === 'unverified') {
      expect(value.reason).toBe('waiting on the published table');
    }
  });

  it('omits the reason entirely when none is given', () => {
    const value = unverified<number>();
    expect(Object.prototype.hasOwnProperty.call(value, 'reason')).toBe(false);
  });

  it('requires a source id alongside every verified value', () => {
    const value = verified('Lackland AFB', 'src-af-1');
    if (value.status === 'verified') {
      expect(value.sourceId).toBe('src-af-1');
    }
  });
});

describe('source staleness', () => {
  const source = (lastVerifiedAt: string): Source => ({
    id: 's1',
    title: 'Fitness standards',
    organization: 'Example Command',
    lastVerifiedAt,
  });

  it('accepts a recently checked source', () => {
    expect(
      isSourceStale(source('2026-06-01T00:00:00.000Z'), '2026-08-25T00:00:00.000Z'),
    ).toBe(false);
  });

  // A citation nobody has re-read in over a year is a claim, not a source.
  it('flags a source past the review interval', () => {
    expect(
      isSourceStale(source('2024-01-01T00:00:00.000Z'), '2026-08-25T00:00:00.000Z'),
    ).toBe(true);
  });

  it('treats an unparseable date as stale rather than fresh', () => {
    expect(isSourceStale(source('not-a-date'), '2026-08-25T00:00:00.000Z')).toBe(true);
  });

  it('uses a one year review interval', () => {
    expect(SOURCE_REVIEW_INTERVAL_DAYS).toBe(365);
  });
});
