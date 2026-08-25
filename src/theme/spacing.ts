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

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;

/** Minimum touch target per Apple HIG. */
export const MIN_TOUCH_TARGET = 44;

export const hairline = {
  width: 1,
} as const;
