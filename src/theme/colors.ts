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
  // Filled accent blocks are white, so their label is black.
  textOnAccent: palette.black900,

  // Accent. Light rather than a hue.
  accent: palette.white100,
  // A press dims rather than brightens here, because the accent is already at
  // maximum light and has nowhere brighter to go.
  accentPressed: palette.white200,
  accentStrong: palette.white100,
  accentBorder: palette.whiteBorder,
  accentSurface: palette.whiteSurface,

  // Status.
  //
  // On target is full white: in a monochrome system, lit means good. Only the
  // two failure states carry a hue, because "something is off" is the one
  // message worth spending colour on. Direction is never carried by colour
  // alone -- DeltaBadge always renders a sign and StatusIndicator requires a
  // label.
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
