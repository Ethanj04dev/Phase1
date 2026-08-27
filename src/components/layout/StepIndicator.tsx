import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface StepIndicatorProps {
  /** 1-based. */
  step: number;
  total: number;
}

/**
 * Progress through a multi-step flow. The segments are decorative; the
 * "STEP 02 / 04" label carries the same information for screen readers and
 * for anyone who cannot distinguish the filled segments.
 */
export function StepIndicator({ step, total }: StepIndicatorProps) {
  const theme = useTheme();
  const segments = Array.from({ length: total }, (_, index) => index);

  return (
    <View
      accessible
      accessibilityLabel={`Step ${step} of ${total}`}
      style={{ gap: theme.spacing.sm }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', gap: theme.spacing.xs }}
      >
        {segments.map((index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              backgroundColor: index < step ? theme.colors.accent : theme.colors.trackEmpty,
            }}
          />
        ))}
      </View>
      <Text variant="labelSm" color="textTertiary">
        {`Step ${step} of ${total}`}
      </Text>
    </View>
  );
}
