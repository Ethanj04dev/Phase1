import {
  HANDLE_MAX_LENGTH,
  normalizeHandle,
  RESERVED_HANDLES,
  validateHandle,
} from './handle';

describe('normalizeHandle', () => {
  it('lowercases, trims, and strips a leading @', () => {
    expect(normalizeHandle('@Ethan')).toBe('ethan');
    expect(normalizeHandle('  Ethan  ')).toBe('ethan');
    expect(normalizeHandle('@@EJones')).toBe('ejones');
  });

  it('treats differently-cased spellings as the same handle', () => {
    expect(normalizeHandle('@Ethan')).toBe(normalizeHandle('@ethan'));
    expect(normalizeHandle('EJones_04')).toBe(normalizeHandle('ejones_04'));
  });

  it('does not remove invalid characters — that is validation, not identity', () => {
    expect(normalizeHandle('e jones')).toBe('e jones');
  });
});

describe('validateHandle', () => {
  it('accepts a well-formed handle and keeps the typed casing for display', () => {
    const result = validateHandle('@EJones_04');
    expect(result).toEqual({ ok: true, handle: 'ejones_04', displayHandle: 'EJones_04' });
  });

  it('accepts the minimum and maximum lengths', () => {
    expect(validateHandle('abc').ok).toBe(true);
    expect(validateHandle('a'.repeat(HANDLE_MAX_LENGTH)).ok).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['@', 'empty'],
    ['ab', 'too_short'],
    ['a'.repeat(HANDLE_MAX_LENGTH + 1), 'too_long'],
    ['e jones', 'invalid_characters'],
    ['e-jones', 'invalid_characters'],
    ['éthan', 'invalid_characters'],
    ['ethan!', 'invalid_characters'],
    ['1ethan', 'must_start_with_letter'],
    ['_ethan', 'must_start_with_letter'],
  ])('rejects %j as %s', (input, problem) => {
    const result = validateHandle(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toBe(problem);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('rejects reserved handles regardless of casing', () => {
    for (const reserved of RESERVED_HANDLES) {
      // Some reserved words fail structural rules first (none currently do,
      // but the loop should not silently pass if one ever does).
      const result = validateHandle(reserved.toUpperCase());
      expect(result.ok).toBe(false);
    }
    const result = validateHandle('@Admin');
    expect(result).toMatchObject({ ok: false, problem: 'reserved' });
  });

  it('length limits apply to the handle, not the typed @ prefix', () => {
    expect(validateHandle(`@${'a'.repeat(HANDLE_MAX_LENGTH)}`).ok).toBe(true);
  });
});
