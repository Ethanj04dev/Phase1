import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useTheme } from '@/theme';

export interface GridBackdropProps {
  /** Number of cells across and down. Fewer cells reads as a map, not graph paper. */
  divisions?: number;
  opacity?: number;
}

/**
 * The map-grid motif. Sits behind hero content at very low opacity to give
 * flat dark surfaces a sense of being an instrument panel. Purely decorative,
 * so it is hidden from assistive technology and ignores touches.
 */
export function GridBackdrop({ divisions = 6, opacity = 0.5 }: GridBackdropProps) {
  const theme = useTheme();

  const fractions = Array.from(
    { length: divisions - 1 },
    (_, index) => `${((index + 1) / divisions) * 100}%`,
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      <Svg width="100%" height="100%">
        {fractions.map((fraction) => (
          <Line
            key={`v-${fraction}`}
            x1={fraction}
            y1="0%"
            x2={fraction}
            y2="100%"
            stroke={theme.colors.grid}
            strokeWidth={1}
          />
        ))}
        {fractions.map((fraction) => (
          <Line
            key={`h-${fraction}`}
            x1="0%"
            y1={fraction}
            x2="100%"
            y2={fraction}
            stroke={theme.colors.grid}
            strokeWidth={1}
          />
        ))}
      </Svg>
    </View>
  );
}
