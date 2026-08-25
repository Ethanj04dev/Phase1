import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface DeltaBadgeProps {
  /** Signed change. Positive is an improvement unless `lowerIsBetter`. */
  delta: number;
  /** True for time-based metrics, where a negative delta is a faster time. */
  lowerIsBetter?: boolean;
  /** Trailing context, e.g. "THIS MONTH". */
  caption?: string;
  /** Formats the magnitude — defaults to a plain integer. */
  format?: (magnitude: number) => string;
}

/**
 * The sign is always rendered, so the direction of change survives without
 * colour perception.
 */
export function DeltaBadge({
  delta,
  lowerIsBetter = false,
  caption,
  format = (magnitude) => String(Math.round(magnitude)),
}: DeltaBadgeProps) {
  const theme = useTheme();

  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const unchanged = delta === 0;

  const color = unchanged
    ? theme.colors.textTertiary
    : improved
      ? theme.colors.statusOnTarget
      : theme.colors.statusOffTarget;

  const sign = unchanged ? '' : delta > 0 ? '+' : '-';
  const magnitude = format(Math.abs(delta));
  const readable = unchanged
    ? 'No change'
    : `${improved ? 'Improved by' : 'Down by'} ${magnitude}`;

  return (
    <View
      accessible
      accessibilityLabel={caption ? `${readable}, ${caption}` : readable}
      style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}
    >
      <Text variant="labelSm" style={{ color }}>
        {`${sign}${magnitude}`}
      </Text>
      {caption ? (
        <Text variant="labelSm" color="textTertiary">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
