import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorToken, type TypographyVariant } from '@/theme';

/**
 * Large metrics are capped at a modest scaling multiplier: a 64pt number at
 * the largest accessibility size would push the readiness hero off screen.
 * Prose variants keep full Dynamic Type support.
 */
const METRIC_VARIANTS = new Set<TypographyVariant>([
  'display',
  'metricXl',
  'metricLg',
  'metricMd',
]);

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

export function Text({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const theme = useTheme();

  return (
    <RNText
      maxFontSizeMultiplier={
        maxFontSizeMultiplier ?? (METRIC_VARIANTS.has(variant) ? 1.3 : undefined)
      }
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}
