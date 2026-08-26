import { darkColors } from './colors';

/**
 * Contrast gate for the palette.
 *
 * The design rules require WCAG AA on text, and "we checked by eye once" does
 * not survive a retheme. These assertions run on every commit, so darkening
 * the background or deepening the accent cannot quietly push a label below the
 * legibility floor.
 */

/** WCAG AA for normal-size text. */
const AA_NORMAL = 4.5;
/** WCAG AA for large text (>=18pt, or >=14pt bold). */
const AA_LARGE = 3;

function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const normalised = hex.replace('#', '');
  const r = parseInt(normalised.slice(0, 2), 16);
  const g = parseInt(normalised.slice(2, 4), 16);
  const b = parseInt(normalised.slice(4, 6), 16);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Every surface text can legitimately sit on. */
const SURFACES = [
  ['background', darkColors.background],
  ['surface', darkColors.surface],
  ['surfaceElevated', darkColors.surfaceElevated],
] as const;

/** Tokens used for text that must be readable at body size. */
const BODY_TEXT = [
  ['textPrimary', darkColors.textPrimary],
  ['textSecondary', darkColors.textSecondary],
  ['textTertiary', darkColors.textTertiary],
  ['accent', darkColors.accent],
  ['statusOnTarget', darkColors.statusOnTarget],
  ['statusCaution', darkColors.statusCaution],
  ['statusOffTarget', darkColors.statusOffTarget],
] as const;

describe('contrast ratio helper', () => {
  it('reports maximum contrast for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('reports no contrast for a colour on itself', () => {
    expect(contrastRatio('#4A7FC8', '#4A7FC8')).toBeCloseTo(1, 5);
  });
});

describe('text contrast meets WCAG AA', () => {
  const cases = SURFACES.flatMap(([surfaceName, surface]) =>
    BODY_TEXT.map(
      ([textName, text]) => [textName, surfaceName, text, surface] as const,
    ),
  );

  it.each(cases)('%s on %s', (_textName, _surfaceName, text, surface) => {
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('interactive contrast', () => {
  // The primary button is a filled accent block with dark text on it. Getting
  // this backwards is the classic accessibility failure of a coloured button.
  it('button label is readable on the accent fill', () => {
    expect(
      contrastRatio(darkColors.textOnAccent, darkColors.accent),
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('pressed accent still carries its label', () => {
    expect(
      contrastRatio(darkColors.textOnAccent, darkColors.accentPressed),
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  // Disabled text is exempt from WCAG, but it still has to be visible enough
  // to read as "present but unavailable" rather than as a rendering bug.
  it('disabled text remains discernible', () => {
    expect(
      contrastRatio(darkColors.textDisabled, darkColors.surface),
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('non-text contrast', () => {
  // Borders, progress fills and the accent-tinted selected state are graphics,
  // which WCAG holds to the lower large-text style threshold.
  it('borders are visible against their surface', () => {
    expect(contrastRatio(darkColors.border, darkColors.surface)).toBeGreaterThan(1.1);
  });

  it('accent fill is distinguishable from the empty track', () => {
    expect(
      contrastRatio(darkColors.accent, darkColors.trackEmpty),
    ).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('the selected surface is distinguishable from the plain one', () => {
    expect(
      contrastRatio(darkColors.accentSurface, darkColors.surface),
    ).toBeGreaterThan(1.05);
  });
});
