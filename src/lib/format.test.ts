import {
  formatDateStamp,
  formatDistance,
  formatDuration,
  formatDurationRange,
  formatPercent,
  formatPosition,
} from './format';

describe('formatDuration', () => {
  it('renders sub-hour durations as minutes and seconds', () => {
    expect(formatDuration(568)).toBe('9:28');
    expect(formatDuration(62)).toBe('1:02');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('renders hour-plus durations with an hours segment', () => {
    expect(formatDuration(3852)).toBe('1:04:12');
    expect(formatDuration(3600)).toBe('1:00:00');
  });

  it('rounds fractional seconds', () => {
    expect(formatDuration(206.6)).toBe('3:27');
  });

  it('returns a placeholder for invalid input rather than throwing', () => {
    expect(formatDuration(-1)).toBe('--:--');
    expect(formatDuration(Number.NaN)).toBe('--:--');
  });
});

describe('formatDurationRange', () => {
  it('renders an interval target window', () => {
    expect(formatDurationRange(200, 210)).toBe('3:20-3:30');
  });
});

describe('formatDistance', () => {
  it('keeps sub-kilometre distances in metres', () => {
    expect(formatDistance(800)).toBe('800m');
    expect(formatDistance(100)).toBe('100m');
  });

  it('converts longer distances to miles', () => {
    expect(formatDistance(1609.344)).toBe('1 mi');
    expect(formatDistance(8046.72)).toBe('5 mi');
  });

  it('shows one decimal for part-mile distances', () => {
    expect(formatDistance(2400)).toBe('1.5 mi');
  });

  it('returns a placeholder for invalid input', () => {
    expect(formatDistance(-5)).toBe('--');
  });
});

describe('formatPercent', () => {
  it('rounds to whole percentages', () => {
    expect(formatPercent(0.6)).toBe('60%');
    expect(formatPercent(0.865)).toBe('87%');
  });

  it('clamps out-of-range values', () => {
    expect(formatPercent(1.4)).toBe('100%');
    expect(formatPercent(-0.2)).toBe('0%');
  });
});

describe('formatPosition', () => {
  it('zero-pads to two digits', () => {
    expect(formatPosition('WEEK', 4)).toBe('WEEK 04');
    expect(formatPosition('DAY', 12)).toBe('DAY 12');
  });
});

describe('formatDateStamp', () => {
  it('renders an uppercase month and padded day', () => {
    // Constructed via local-time parts so the assertion does not depend on the
    // timezone the test runs in.
    expect(formatDateStamp(new Date(2026, 7, 25))).toBe('AUG 25');
    expect(formatDateStamp(new Date(2026, 0, 3))).toBe('JAN 03');
  });
});
