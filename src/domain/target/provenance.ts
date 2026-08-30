import type { IsoDate } from '@/domain/types';

/**
 * Provenance for anything Zero Phase presents as official.
 *
 * The central rule of this product is that a Zero Phase recommendation must never
 * be mistaken for a military requirement. That rule is enforced here by types
 * rather than by discipline: an unverified value carries no number at all, so
 * there is nothing for a screen to render even by accident. A plausible
 * placeholder cannot leak into the UI because it cannot be represented.
 */

export interface Source {
  id: string;
  /** Document or page title, as published. */
  title: string;
  /** Publishing body, e.g. a specific service or command. */
  organization: string;
  url?: string;
  /** When the cited document itself took effect, where stated. */
  effectiveDate?: IsoDate;
  /** When a human last checked this source still says what we claim. */
  lastVerifiedAt: IsoDate;
}

/**
 * A value that is either backed by a cited source, or explicitly not yet
 * verified. There is deliberately no third state and no default.
 */
export type Verified<T> =
  | { status: 'verified'; value: T; sourceId: string }
  | { status: 'unverified'; reason?: string };

export function verified<T>(value: T, sourceId: string): Verified<T> {
  return { status: 'verified', value, sourceId };
}

/**
 * The honest state for anything not yet researched. `reason` is for the
 * developer, not the athlete; the UI says "Verification required" regardless.
 */
export function unverified<T>(reason?: string): Verified<T> {
  return reason === undefined ? { status: 'unverified' } : { status: 'unverified', reason };
}

export function isVerified<T>(
  value: Verified<T>,
): value is { status: 'verified'; value: T; sourceId: string } {
  return value.status === 'verified';
}

/**
 * Reads the value, or null when unverified.
 *
 * The null is the point: every call site is forced to decide what to show when
 * there is no verified figure, and the only correct answer is to say so.
 */
export function verifiedValue<T>(value: Verified<T>): T | null {
  return value.status === 'verified' ? value.value : null;
}

/** Standard label for an unverified figure. One wording, used everywhere. */
export const VERIFICATION_REQUIRED = 'Verification required';

/**
 * A source is stale once it has not been re-checked inside this window.
 * Military standards change, and a citation nobody has looked at in two years
 * is a claim, not a source.
 */
export const SOURCE_REVIEW_INTERVAL_DAYS = 365;

export function isSourceStale(source: Source, now: IsoDate): boolean {
  const checked = Date.parse(source.lastVerifiedAt);
  const current = Date.parse(now);
  if (Number.isNaN(checked) || Number.isNaN(current)) {
    return true;
  }
  return current - checked > SOURCE_REVIEW_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}
