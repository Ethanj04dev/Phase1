import type { TextStyle } from 'react-native';

/**
 * Type system, built on IBM Plex.
 *
 * The system font was the wrong voice: SF Pro is humanist and friendly, and
 * next to a stark screen-printed mark it reads soft and generic. Plex was
 * drawn for engineering contexts -- squared terminals, mechanical curves, a
 * deliberately unglamorous tone -- which is what "instrumentation for the
 * body" actually looks like as type.
 *
 * Three roles from one superfamily, so display, prose and data are related
 * rather than merely adjacent:
 *
 *   Condensed  display metrics and operational labels. The narrow set gives
 *              big numbers density and uppercase labels a stencilled feel.
 *   Sans       prose. Readable at body size without going soft.
 *   Mono       dates, intervals, identifiers, split times. Anything that is
 *              read as data rather than as language.
 */

export const fontFamilies = {
  condensed: 'IBMPlexSansCondensed_600SemiBold',
  condensedBold: 'IBMPlexSansCondensed_700Bold',
  sans: 'IBMPlexSans_400Regular',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const monoFontFamily = fontFamilies.mono;

/**
 * Tabular figures stop large metrics from jittering as digits change during a
 * live timer or an animated count-up. Plex Mono is tabular by construction;
 * this covers the proportional faces.
 */
export const tabularNumbers: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/**
 * Weight is carried by the font family, not by fontWeight.
 *
 * React Native maps a custom `fontFamily` to one physical face. Asking for
 * `fontWeight: '800'` on top of it makes the platform synthesise a fake bold,
 * which smears the letterforms. Naming the actual face is what keeps the
 * type crisp.
 */

// --- Metric scale -----------------------------------------------------------

const display: TextStyle = {
  fontFamily: fontFamilies.condensedBold,
  fontSize: 68,
  lineHeight: 70,
  letterSpacing: -1.5,
  ...tabularNumbers,
};

const metricXl: TextStyle = {
  fontFamily: fontFamilies.condensedBold,
  fontSize: 50,
  lineHeight: 52,
  letterSpacing: -1,
  ...tabularNumbers,
};

const metricLg: TextStyle = {
  fontFamily: fontFamilies.condensedBold,
  fontSize: 36,
  lineHeight: 40,
  letterSpacing: -0.6,
  ...tabularNumbers,
};

const metricMd: TextStyle = {
  fontFamily: fontFamilies.condensed,
  fontSize: 25,
  lineHeight: 29,
  letterSpacing: -0.3,
  ...tabularNumbers,
};

// --- Prose scale ------------------------------------------------------------

const title: TextStyle = {
  fontFamily: fontFamilies.sansSemiBold,
  fontSize: 22,
  lineHeight: 28,
  letterSpacing: -0.3,
};

const headline: TextStyle = {
  fontFamily: fontFamilies.sansSemiBold,
  fontSize: 17,
  lineHeight: 22,
  letterSpacing: -0.1,
};

const body: TextStyle = {
  fontFamily: fontFamilies.sans,
  fontSize: 16,
  lineHeight: 23,
};

const bodySm: TextStyle = {
  fontFamily: fontFamilies.sans,
  fontSize: 14,
  lineHeight: 20,
};

const caption: TextStyle = {
  fontFamily: fontFamilies.sans,
  fontSize: 13,
  lineHeight: 18,
};

// --- Operational labels -----------------------------------------------------
// Condensed and widely tracked, so they read as markings stamped on a plate
// rather than as UI captions.

const label: TextStyle = {
  fontFamily: fontFamilies.condensedBold,
  fontSize: 12.5,
  lineHeight: 16,
  letterSpacing: 1.7,
  textTransform: 'uppercase',
};

const labelSm: TextStyle = {
  fontFamily: fontFamilies.condensedBold,
  fontSize: 10.5,
  lineHeight: 14,
  letterSpacing: 1.9,
  textTransform: 'uppercase',
};

// --- Monospace --------------------------------------------------------------

const mono: TextStyle = {
  fontFamily: fontFamilies.mono,
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.2,
};

const monoSm: TextStyle = {
  fontFamily: fontFamilies.monoMedium,
  fontSize: 10,
  lineHeight: 14,
  letterSpacing: 0.4,
};

export const typography = {
  display,
  metricXl,
  metricLg,
  metricMd,
  title,
  headline,
  body,
  bodySm,
  caption,
  label,
  labelSm,
  mono,
  monoSm,
};

export type TypographyVariant = keyof typeof typography;
