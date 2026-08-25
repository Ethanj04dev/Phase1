import { Platform, type TextStyle } from 'react-native';

/**
 * Typography is deliberately system-native: on iOS this resolves to SF Pro,
 * which is what makes the app feel like instrumentation rather than a web
 * page in a wrapper. No webfont download, no licence, no flash of unstyled
 * text. `fontFamily` is left undefined for the system variants so React
 * Native uses the platform face directly.
 */
export const monoFontFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

/**
 * Tabular figures stop large metrics from jittering as digits change during
 * a live timer or an animated count-up.
 */
export const tabularNumbers: TextStyle = {
  fontVariant: ['tabular-nums'],
};

// --- Metric scale -----------------------------------------------------------
// Big numbers carry the product. Tight negative tracking keeps them dense.

const display: TextStyle = {
  fontSize: 64,
  lineHeight: 66,
  fontWeight: '700',
  letterSpacing: -2.5,
  ...tabularNumbers,
};

const metricXl: TextStyle = {
  fontSize: 48,
  lineHeight: 50,
  fontWeight: '700',
  letterSpacing: -1.8,
  ...tabularNumbers,
};

const metricLg: TextStyle = {
  fontSize: 34,
  lineHeight: 38,
  fontWeight: '700',
  letterSpacing: -1.1,
  ...tabularNumbers,
};

const metricMd: TextStyle = {
  fontSize: 24,
  lineHeight: 28,
  fontWeight: '600',
  letterSpacing: -0.5,
  ...tabularNumbers,
};

// --- Prose scale ------------------------------------------------------------

const title: TextStyle = {
  fontSize: 22,
  lineHeight: 28,
  fontWeight: '600',
  letterSpacing: -0.4,
};

const headline: TextStyle = {
  fontSize: 17,
  lineHeight: 22,
  fontWeight: '600',
  letterSpacing: -0.2,
};

const body: TextStyle = {
  fontSize: 16,
  lineHeight: 23,
  fontWeight: '400',
};

const bodySm: TextStyle = {
  fontSize: 14,
  lineHeight: 20,
  fontWeight: '400',
};

const caption: TextStyle = {
  fontSize: 13,
  lineHeight: 18,
  fontWeight: '400',
};

// --- Operational labels -----------------------------------------------------
// Compact uppercase labels are the main "military influence" in the type
// system. Used sparingly, they read as instrumentation rather than costume.

const label: TextStyle = {
  fontSize: 12,
  lineHeight: 16,
  fontWeight: '600',
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

const labelSm: TextStyle = {
  fontSize: 10,
  lineHeight: 14,
  fontWeight: '700',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
};

// --- Monospace --------------------------------------------------------------
// Reserved for dates, identifiers, intervals and split times. Never body copy.

const mono: TextStyle = {
  fontFamily: monoFontFamily,
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.4,
};

const monoSm: TextStyle = {
  fontFamily: monoFontFamily,
  fontSize: 10,
  lineHeight: 14,
  letterSpacing: 0.6,
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
