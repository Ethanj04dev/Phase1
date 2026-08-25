/**
 * Raw colour values. Nothing outside `colors.ts` should import from here —
 * screens and components consume *semantic* tokens so the palette can be
 * retuned (or white-labelled for a partner) without touching the UI layer.
 *
 * Contrast note: every value used for text has been checked against the
 * `background` and `surface` tokens for WCAG AA (>= 4.5:1 at body size).
 */
export const palette = {
  // Neutrals — near-black through off-white, very slightly cool. The tint is
  // deliberate: a warm or green-cast charcoal under a blue accent reads muddy.
  black900: '#080A0D',
  black800: '#0C0E12',
  black700: '#151821',
  black600: '#1C2029',
  black500: '#252A34',
  black400: '#333944',
  grey500: '#4A505C',
  grey400: '#7B8290',
  grey300: '#99A0AE',
  white100: '#F0F2F5',

  // Signal blue — the single brand accent. Restrained on purpose: never neon,
  // never a saturated "tech" blue. 5.9:1 against the background.
  blue600: '#2C4570',
  blue500: '#4A79C0',
  blue400: '#5B8FD6',
  blue300: '#8AB2E8',
  blue100: '#111827',

  // Status. Restrained; used as small indicators, never as screen washes.
  // Positive is its own green rather than the accent, so "on target" never
  // reads as merely "branded".
  green400: '#6FA96F',
  green100: '#101A11',
  amber400: '#C7A03C',
  amber100: '#241D0C',
  red400: '#CC6B54',
  red100: '#261310',
} as const;

export type Palette = typeof palette;
