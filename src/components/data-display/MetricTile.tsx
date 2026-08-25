import { View } from 'react-native';

import { Card } from '@/components/primitives/Card';
import { ProgressBar, type ProgressTone } from '@/components/primitives/ProgressBar';
import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface MetricTileProps {
  label: string;
  value: string;
  unit?: string;
  /** 0–1. Omit for tiles that are not a share of a target. */
  progress?: number;
  tone?: ProgressTone;
  onPress?: () => void;
}

export function MetricTile({
  label,
  value,
  unit,
  progress,
  tone = 'accent',
  onPress,
}: MetricTileProps) {
  const theme = useTheme();

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={onPress ? `${label}, ${value}${unit ? ` ${unit}` : ''}` : undefined}
      style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      <Text variant="labelSm" color="textTertiary" numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
        <Text variant="metricLg">{value}</Text>
        {unit ? (
          <Text variant="labelSm" color="textTertiary">
            {unit}
          </Text>
        ) : null}
      </View>
      {progress === undefined ? null : (
        <ProgressBar value={progress} tone={tone} accessibilityLabel={label} />
      )}
    </Card>
  );
}
