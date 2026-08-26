/** 4pt spacing scale. Generous whitespace is part of the product's voice. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Horizontal gutter used by every full-width screen. */
export const SCREEN_GUTTER = spacing.xl;

/**
 * Corner radii, kept deliberately tight.
 *
 * The product mark is rails, slots and hard edges; soft twelve-pixel corners
 * read as a consumer dashboard and fight it. Small radii keep the surfaces
 * feeling like machined plates rather than cards, without going fully square,
 * which on a phone reads as unfinished.
 */
export const radii = {
  none: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  xxl: 6,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;

/** Minimum touch target per Apple HIG. */
export const MIN_TOUCH_TARGET = 44;

export const hairline = {
  width: 1,
} as const;
