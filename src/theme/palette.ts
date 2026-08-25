/**
 * Raw colour values. Nothing outside `colors.ts` should import from here —
 * screens and components consume *semantic* tokens so the palette can be
 * retuned (or white-labelled for a partner) without touching the UI layer.
 *
 * Contrast note: every value used for text has been checked against the
 * `background` and `surface` tokens for WCAG AA (>= 4.5:1 at body size).
 */
export const palette = {
  // Neutrals — near-black through off-white.
  black900: '#090B0A',
  black800: '#0C0E0D',
  black700: '#151816',
  black600: '#1C201E',
  black500: '#252A27',
  black400: '#333935',
  grey500: '#4A524C',
  grey400: '#7B837C',
  grey300: '#9AA29B',
  white100: '#F2F3EF',

  // Field green — the single brand accent. Muted on purpose: never neon.
  green600: '#4A5940',
  green500: '#6A8550',
  green400: '#7C9A5E',
  green300: '#9AB57D',
  green100: '#1A2016',

  // Status. Restrained; used as small indicators, never as screen washes.
  amber400: '#C7A03C',
  amber100: '#241D0C',
  red400: '#CC6B54',
  red100: '#261310',
} as const;

export type Palette = typeof palette;
