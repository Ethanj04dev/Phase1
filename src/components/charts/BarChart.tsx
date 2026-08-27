import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface BarDatum {
  label: string;
  value: number;
  /** Draws this bar in the accent colour, e.g. the current week. */
  highlight?: boolean;
}

export interface BarChartProps {
  data: readonly BarDatum[];
  height?: number;
  formatValue: (value: number) => string;
  accessibilityLabel: string;
}

/**
 * Weekly totals. Built from views rather than SVG: rectangles with rounded
 * corners are exactly what the layout engine is good at, and this way the bars
 * inherit the theme without a second styling path.
 *
 * Zero-value weeks still render a hairline stub so a missed week reads as a
 * gap in the series rather than as a week that never happened.
 */
export function BarChart({
  data,
  height = 120,
  formatValue,
  accessibilityLabel,
}: BarChartProps) {
  const theme = useTheme();
  const max = data.reduce((highest, datum) => Math.max(highest, datum.value), 0);

  if (data.length === 0) {
    return (
      <View
        accessible
        accessibilityLabel={`${accessibilityLabel}. No data yet.`}
        style={{
          height,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.backgroundSunken,
        }}
      >
        <Text variant="labelSm" color="textTertiary">
          NO DATA YET
        </Text>
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          height,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.spacing.xs,
        }}
      >
        {data.map((datum, index) => {
          const ratio = max > 0 ? datum.value / max : 0;
          return (
            <View
              key={`${datum.label}-${index}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  height: Math.max(2, ratio * height),
                  borderRadius: theme.radii.sm,
                  backgroundColor: datum.highlight
                    ? theme.colors.accent
                    : datum.value > 0
                      ? theme.colors.accentBorder
                      : theme.colors.trackEmpty,
                }}
              />
            </View>
          );
        })}
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', gap: theme.spacing.xs }}
      >
        {data.map((datum, index) => (
          <Text
            key={`${datum.label}-label-${index}`}
            variant="monoSm"
            color="textTertiary"
            align="center"
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {datum.label}
          </Text>
        ))}
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text variant="labelSm" color="textTertiary">
          Peak
        </Text>
        <Text variant="monoSm" color="textSecondary">
          {formatValue(max)}
        </Text>
      </View>
    </View>
  );
}
