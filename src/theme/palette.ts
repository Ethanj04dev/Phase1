/**
 * Raw colour values. Nothing outside `colors.ts` should import from here —
 * screens and components consume *semantic* tokens so the palette can be
 * retuned (or white-labelled for a partner) without touching the UI layer.
 *
 * The system is monochrome, taken from the product mark: a stark white
 * screen-printed helmet on black, with no colour anywhere in it. Light is the
 * accent. Colour appears only where it carries information a label cannot, and
 * even then it is muted to read as printed ink rather than as a web palette.
 *
 * Contrast is enforced by `contrast.test.ts`, not by eye.
 */
export const palette = {
  // Neutrals — true black upward. Deliberately untinted: the mark is neutral
  // black and white, and a blue or warm cast in the greys fights it.
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

  // Light is the accent. On a black ground, the brightest thing on screen is
  // the emphasis, which is exactly how the mark works.
  white200: '#D6D6D6',
  whiteSurface: '#1A1A1A',
  whiteBorder: '#4A4A4A',

  // Status. Muted to the point of looking like ink on paper. Reinforcement
  // only: every status in the UI also carries a label or a sign.
  amber400: '#A98B4A',
  amber100: '#171208',
  red400: '#C4685A',
  red100: '#170B09',
} as const;

export type Palette = typeof palette;
