import { countdownLabel, countdownTo, parseSelectionDateInput } from './countdown';

/**
 * Timestamps built from local components, not UTC literals. A UTC instant is
 * a different calendar day depending on the machine's timezone, and these
 * tests must pass identically in Kansas and in Kabul.
 */
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const NOW = localIso(2026, 8, 28, 14);

describe('countdown', () => {
  it('is silent with no date', () => {
    expect(countdownTo(null, NOW)).toEqual({ state: 'none' });
    expect(countdownTo(undefined, NOW)).toEqual({ state: 'none' });
    expect(countdownLabel({ state: 'none' })).toBeNull();
  });

  it('counts whole weeks, flooring rather than flattering', () => {
    // 98 days out is exactly 14 weeks; 97 is still 13, not "almost 14".
    expect(countdownTo('2026-12-04', NOW)).toEqual({ state: 'future', days: 98, weeks: 14 });
    expect(countdownTo('2026-12-03', NOW)).toEqual({ state: 'future', days: 97, weeks: 13 });
  });

  it('holds the same count all week', () => {
    // "14 weeks out" must still read 14 on the first day of those weeks.
    const first = countdownTo('2026-12-04', localIso(2026, 8, 28, 0));
    const last = countdownTo('2026-12-04', localIso(2026, 9, 3, 23));
    expect(first).toEqual({ state: 'future', days: 98, weeks: 14 });
    expect(last).toEqual({ state: 'future', days: 92, weeks: 13 });
  });

  it('switches to days inside the final week', () => {
    expect(countdownTo('2026-09-03', NOW)).toEqual({ state: 'this_week', days: 6 });
    expect(countdownTo('2026-08-29', NOW)).toEqual({ state: 'this_week', days: 1 });
  });

  it('names selection day itself', () => {
    expect(countdownTo('2026-08-28', NOW)).toEqual({ state: 'this_week', days: 0 });
    expect(countdownLabel({ state: 'this_week', days: 0 })).toBe('Selection day');
  });

  // A countdown that changes at 2pm because of clock arithmetic is a
  // countdown nobody trusts. Both ends are read at local start of day.
  it('does not change during the day', () => {
    const morning = countdownTo('2026-09-11', localIso(2026, 8, 28, 0));
    const night = countdownTo('2026-09-11', localIso(2026, 8, 28, 23));
    expect(morning).toEqual(night);
  });

  it('reports a past date as past, without guessing the outcome', () => {
    expect(countdownTo('2026-08-27', NOW)).toEqual({ state: 'past' });
    expect(countdownLabel({ state: 'past' })).toBe('Your selection date has passed');
  });

  it('treats garbage as no date rather than as a countdown', () => {
    expect(countdownTo('not-a-date', NOW)).toEqual({ state: 'none' });
  });

  it('reads singulars correctly', () => {
    expect(countdownLabel({ state: 'future', days: 7, weeks: 1 })).toBe('1 week to selection');
    expect(countdownLabel({ state: 'this_week', days: 1 })).toBe('1 day to selection');
  });
});

describe('parsing the entered date', () => {
  it('accepts the unambiguous form', () => {
    expect(parseSelectionDateInput('2027-03-04')).toBe('2027-03-04');
    expect(parseSelectionDateInput('  2027-03-04  ')).toBe('2027-03-04');
  });

  // "03/04/2027" is March 4th or April 3rd depending on where you grew up,
  // and a countdown built on the wrong reading is confidently wrong for
  // months. Only one format exists.
  it('rejects every ambiguous format', () => {
    expect(parseSelectionDateInput('03/04/2027')).toBeNull();
    expect(parseSelectionDateInput('4 March 2027')).toBeNull();
    expect(parseSelectionDateInput('2027-3-4')).toBeNull();
  });

  it('rejects dates that do not exist', () => {
    expect(parseSelectionDateInput('2027-02-30')).toBeNull();
    expect(parseSelectionDateInput('2027-13-01')).toBeNull();
    expect(parseSelectionDateInput('2027-00-10')).toBeNull();
  });
});
