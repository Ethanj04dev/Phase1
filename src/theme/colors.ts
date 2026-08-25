import { palette } from './palette';

/**
 * Semantic colour tokens. Components reference intent ("textSecondary",
 * "statusCaution"), never raw hex, so the whole surface can be re-themed
 * from one file.
 */
export const darkColors = {
  // Surfaces, back to front.
  background: palette.black800,
  backgroundSunken: palette.black900,
  surface: palette.black700,
  surfaceElevated: palette.black600,
  surfacePressed: palette.black500,

  // Hairlines and structure. `grid` powers the subtle map-grid motif.
  border: palette.black500,
  borderStrong: palette.black400,
  grid: palette.black500,

  // Text.
  textPrimary: palette.white100,
  textSecondary: palette.grey300,
  textTertiary: palette.grey400,
  textDisabled: palette.grey500,
  textOnAccent: palette.black900,

  // Brand accent.
  accent: palette.blue400,
  accentPressed: palette.blue500,
  accentStrong: palette.blue300,
  accentBorder: palette.blue600,
  accentSurface: palette.blue100,

  // Status. Positive is a green distinct from the blue accent, so "on target"
  // carries meaning rather than just reading as a branded element.
  statusOnTarget: palette.green400,
  statusOnTargetSurface: palette.green100,
  statusCaution: palette.amber400,
  statusCautionSurface: palette.amber100,
  statusOffTarget: palette.red400,
  statusOffTargetSurface: palette.red100,

  // Data visualisation track/fill defaults.
  trackEmpty: palette.black500,

  // Scrims and overlays.
  overlay: 'rgba(9, 11, 10, 0.82)',
  transparent: 'transparent',
} as const;

export type ColorTokens = typeof darkColors;
export type ColorToken = keyof ColorTokens;
