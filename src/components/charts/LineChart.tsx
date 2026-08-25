import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface LineChartProps {
  /** Oldest first. */
  values: readonly number[];
  height?: number;
  /**
   * Plot smaller values higher. Set for time-based metrics so improvement
   * always rises, keeping "up is better" true across every chart in the app.
   */
  invert?: boolean;
  formatValue: (value: number) => string;
  /** Required: the line itself conveys nothing to a screen reader. */
  accessibilityLabel: string;
  tone?: 'accent' | 'onTarget';
}

/**
 * Horizontal units in the viewBox. The chart stretches to whatever width the
 * container gives it.
 */
const VIEW_WIDTH = 100;
const VERTICAL_PADDING = 12;

/**
 * A minimal time series, hand-built rather than pulled from a chart library.
 *
 * Deliberately measurement-free: an earlier version sized itself from
 * `onLayout` and rendered nothing at all when that event did not fire. A
 * viewBox with `preserveAspectRatio="none"` stretches to the container with no
 * measurement step, and `vectorEffect="non-scaling-stroke"` stops the
 * horizontal stretch from thickening the line.
 */
export function LineChart({
  values,
  height = 120,
  invert = false,
  formatValue,
  accessibilityLabel,
  tone = 'accent',
}: LineChartProps) {
  const theme = useTheme();
  const stroke = tone === 'onTarget' ? theme.colors.statusOnTarget : theme.colors.accent;

  if (values.length === 0) {
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

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; a nominal span renders it as a
  // centred straight line instead of collapsing to the baseline.
  const span = max - min || 1;
  const usable = height - VERTICAL_PADDING * 2;

  const points = values.map((value, index) => {
    const ratio = (value - min) / span;
    const normalised = invert ? 1 - ratio : ratio;
    return {
      x: values.length === 1 ? VIEW_WIDTH / 2 : (index / (values.length - 1)) * VIEW_WIDTH,
      // SVG y grows downward, so a high normalised value maps to a small y.
      y: VERTICAL_PADDING + (1 - normalised) * usable,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];
  const areaPath =
    points.length > 1 && first && last
      ? `${linePath} L${last.x} ${height} L${first.x} ${height} Z`
      : '';

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ gap: theme.spacing.sm }}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
      >
        {/* Baseline, so a single point still reads as sitting on a scale. */}
        <Line
          x1={0}
          y1={height - 1}
          x2={VIEW_WIDTH}
          y2={height - 1}
          stroke={theme.colors.border}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {areaPath ? <Path d={areaPath} fill={stroke} fillOpacity={0.12} /> : null}
        <Path
          d={linePath}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text variant="monoSm" color="textTertiary">
          {formatValue(values[0] ?? 0)}
        </Text>
        <Text variant="monoSm" style={{ color: stroke }}>
          {formatValue(values[values.length - 1] ?? 0)}
        </Text>
      </View>
    </View>
  );
}
