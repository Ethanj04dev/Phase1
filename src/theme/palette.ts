/**
 * Raw colour values. Nothing outside `colors.ts` should import from here —
 * screens and components consume *semantic* tokens so the palette can be
 * retuned (or white-labelled for a partner) without touching the UI layer.
 *
 * Two accents, with different jobs:
 *
 *   White  is action and emphasis. It is the brightest thing available on a
 *          black ground, so it marks what the athlete should do or read first.
 *   Blue   is signal. Data, progress, selection, identity. It never competes
 *          with white for attention because it never sits on the primary
 *          action.
 *
 * Neutrals stay untinted black, taken from the product mark.
 * Contrast is enforced by `contrast.test.ts`, not by eye.
 */
export const palette = {
  black900: '#000000',
  black800: '#050505',
  black700: '#0C0C0C',
  black600: '#141414',
  black500: '#232323',
  black400: '#3A3A3A',
  grey500: '#555555',
  grey400: '#8A8A8A',
  grey300: '#B4B4B4',
  white100: '#FFFFFF',
  white200: '#D6D6D6',
  whiteSurface: '#1A1A1A',
  whiteBorder: '#4A4A4A',

  // Steel blue. Deep enough to sit calmly on black, clear of navy so it still
  // reads as a colour rather than as more chrome.
  blue600: '#1E3A5F',
  blue500: '#3A6BA5',
  blue400: '#4E83CC',
  blue300: '#7BA5DE',
  blue100: '#0E1722',

  // Status. Muted to read as ink. Reinforcement only: every status in the UI
  // also carries a label or a sign.
  amber400: '#A98B4A',
  amber100: '#171208',
  red400: '#C4685A',
  red100: '#170B09',
} as const;

export type Palette = typeof palette;
