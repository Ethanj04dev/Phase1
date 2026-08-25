import { darkColors, type ColorTokens } from './colors';
import { motion } from './motion';
import { hairline, MIN_TOUCH_TARGET, radii, SCREEN_GUTTER, spacing } from './spacing';
import { typography } from './typography';

/**
 * A theme is the complete set of design decisions the UI is allowed to make.
 * Only one theme ships today (dark), but the shape is fixed so a light theme
 * or a partner white-label can be added without touching components.
 */
export interface Theme {
  name: string;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
  hairline: typeof hairline;
  screenGutter: number;
  minTouchTarget: number;
}

export const darkTheme: Theme = {
  name: 'dark',
  colors: darkColors,
  spacing,
  radii,
  typography,
  motion,
  hairline,
  screenGutter: SCREEN_GUTTER,
  minTouchTarget: MIN_TOUCH_TARGET,
};

export const defaultTheme = darkTheme;
