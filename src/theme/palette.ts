/**
 * Raw colour values. Nothing outside `colors.ts` should import from here —
 * screens and components consume *semantic* tokens so the palette can be
 * retuned (or white-labelled for a partner) without touching the UI layer.
 *
 * Contrast is enforced by `contrast.test.ts`, not by eye. Every value used for
 * text is asserted against the surface it sits on at WCAG AA, so darkening the
 * palette cannot quietly push a label below the legibility floor. This ramp is
 * the darkest one that still clears every gate.
 */
export const palette = {
  // Neutrals — deep and cool, close to black. Each step is small but stays
  // measurably distinct from the one below, so a card still reads as a card
  // rather than dissolving into the background.
  black900: '#030409',
  black800: '#06080E',
  black700: '#0B0F16',
  black600: '#11151E',
  black500: '#1B212C',
  black400: '#28303D',
  grey500: '#4A5364',
  grey400: '#7F8899',
  grey300: '#99A0AE',
  white100: '#F0F2F5',

  // Steel blue — the single brand accent. Deeper than a bright azure, but kept
  // clear of navy: navy against a near-black background loses its identity and
  // reads as more chrome rather than as the one lit element on the screen.
  blue600: '#234069',
  blue500: '#3A639E',
  blue400: '#4E83CC',
  // Lighter than the base, because on a dark interface a press should add
  // light rather than remove it.
  blue300: '#6E9BDA',
  blue100: '#132038',

  // Status. Restrained; used as small indicators, never as screen washes.
  // Positive is its own green rather than the accent, so "on target" never
  // reads as merely "branded".
  green400: '#6FA96F',
  green100: '#0B130C',
  amber400: '#C7A03C',
  amber100: '#1C1608',
  red400: '#CC6B54',
  red100: '#1E0E0C',
} as const;

export type Palette = typeof palette;
