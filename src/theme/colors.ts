import { palette } from './palette';

/**
 * Semantic colour tokens. Components reference intent ("textSecondary",
 * "statusCaution"), never raw hex, so the whole surface can be re-themed from
 * one file.
 */
export const darkColors = {
  // Surfaces, back to front. The steps are small and the ground is true black,
  // so a card reads as a slightly lifted plate rather than a floating panel.
  background: palette.black800,
  backgroundSunken: palette.black900,
  surface: palette.black700,
  surfaceElevated: palette.black600,
  surfacePressed: palette.black500,

  // Hairlines and structure. Rules are meant to be seen: this interface is
  // closer to a printed spec sheet than to a soft card layout.
  border: palette.black500,
  borderStrong: palette.black400,
  grid: palette.black500,

  // Text.
  textPrimary: palette.white100,
  textSecondary: palette.grey300,
  textTertiary: palette.grey400,
  textDisabled: palette.grey500,

  // --- Emphasis: white ------------------------------------------------------
  // The single most important action on a screen. White on black is the
  // highest-contrast thing the interface can do, so it is spent on exactly one
  // job and never diluted.
  emphasis: palette.white100,
  emphasisPressed: palette.white200,
  emphasisSurface: palette.whiteSurface,
  emphasisBorder: palette.whiteBorder,
  textOnEmphasis: palette.black900,

  // --- Accent: blue ---------------------------------------------------------
  // Signal rather than action: progress, charts, selection, identity. Keeping
  // it off the primary button is what stops the two accents competing.
  accent: palette.blue400,
  accentPressed: palette.blue300,
  accentStrong: palette.blue300,
  accentBorder: palette.blue600,
  accentSurface: palette.blue100,
  textOnAccent: palette.black900,

  // Status.
  //
  // On target is white: lit means good. Only the two failure states carry a
  // hue, because "something is off" is the one message worth spending colour
  // on, and both are muted to read as ink. Direction is never carried by
  // colour alone -- DeltaBadge always renders a sign and StatusIndicator
  // requires a label.
  statusOnTarget: palette.white100,
  statusOnTargetSurface: palette.whiteSurface,
  statusCaution: palette.amber400,
  statusCautionSurface: palette.amber100,
  statusOffTarget: palette.red400,
  statusOffTargetSurface: palette.red100,

  // Data visualisation track/fill defaults.
  trackEmpty: palette.black500,

  // Scrims and overlays.
  overlay: 'rgba(0, 0, 0, 0.86)',
  transparent: 'transparent',
} as const;

export type ColorTokens = typeof darkColors;
export type ColorToken = keyof ColorTokens;
