import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export type StatusTone = 'onTarget' | 'caution' | 'offTarget' | 'neutral';

export interface StatusIndicatorProps {
  tone: StatusTone;
  /**
   * Required, not optional: status is never communicated by colour alone.
   * The dot is reinforcement, the label is the message.
   */
  label: string;
}

export function StatusIndicator({ tone, label }: StatusIndicatorProps) {
  const theme = useTheme();

  const color = {
    onTarget: theme.colors.statusOnTarget,
    caution: theme.colors.statusCaution,
    offTarget: theme.colors.statusOffTarget,
    neutral: theme.colors.textTertiary,
  }[tone];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
      <Text variant="labelSm" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
