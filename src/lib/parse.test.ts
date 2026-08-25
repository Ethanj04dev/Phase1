import { parseDurationInput, parseRepsInput, toDurationInput } from './parse';

describe('parseDurationInput', () => {
  it('parses minutes and seconds', () => {
    expect(parseDurationInput('9:28')).toBe(568);
    expect(parseDurationInput('12:05')).toBe(725);
    expect(parseDurationInput('0:45')).toBe(45);
  });

  it('parses hours, minutes and seconds', () => {
    expect(parseDurationInput('1:04:12')).toBe(3852);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDurationInput('  9:28  ')).toBe(568);
  });

  // The important one: guessing here would silently corrupt a baseline.
  it('rejects a bare number rather than guessing the unit', () => {
    expect(parseDurationInput('930')).toBeNull();
    expect(parseDurationInput('45')).toBeNull();
  });

  it('rejects ambiguous single-digit seconds', () => {
    expect(parseDurationInput('9:5')).toBeNull();
  });

  it('rejects seconds outside 0-59', () => {
    expect(parseDurationInput('9:60')).toBeNull();
    expect(parseDurationInput('9:99')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseDurationInput('')).toBeNull();
    expect(parseDurationInput('abc')).toBeNull();
    expect(parseDurationInput('9:28:')).toBeNull();
    expect(parseDurationInput('-9:28')).toBeNull();
    expect(parseDurationInput('9.28')).toBeNull();
    expect(parseDurationInput('9:28:11:04')).toBeNull();
  });

  it('rejects zero, which is never a real performance', () => {
    expect(parseDurationInput('0:00')).toBeNull();
  });
});

describe('parseRepsInput', () => {
  it('parses whole numbers', () => {
    expect(parseRepsInput('18')).toBe(18);
    expect(parseRepsInput('7')).toBe(7);
  });

  it('accepts zero as an honest answer', () => {
    expect(parseRepsInput('0')).toBe(0);
  });

  it('rejects decimals, negatives and non-numeric text', () => {
    expect(parseRepsInput('12.5')).toBeNull();
    expect(parseRepsInput('-3')).toBeNull();
    expect(parseRepsInput('ten')).toBeNull();
    expect(parseRepsInput('')).toBeNull();
  });

  it('rejects implausible counts', () => {
    expect(parseRepsInput('1000')).toBeNull();
  });
});

describe('toDurationInput', () => {
  it('round-trips through the parser', () => {
    for (const seconds of [45, 568, 725, 3852]) {
      expect(parseDurationInput(toDurationInput(seconds))).toBe(seconds);
    }
  });

  it('returns an empty string for absent or invalid values', () => {
    expect(toDurationInput(0)).toBe('');
    expect(toDurationInput(Number.NaN)).toBe('');
  });
});
