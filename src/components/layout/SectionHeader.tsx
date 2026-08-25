import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface SectionHeaderProps {
  title: string;
  /** Right-aligned metadata — a count, a date, a status. */
  trailing?: ReactNode;
  /** Thin rule that runs from the label to the trailing slot. */
  rule?: boolean;
}

export function SectionHeader({ title, trailing, rule = true }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.md,
      }}
    >
      <Text variant="label" color="textTertiary" accessibilityRole="header">
        {title}
      </Text>
      {rule ? (
        <View
          style={{
            flex: 1,
            height: theme.hairline.width,
            backgroundColor: theme.colors.border,
          }}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {trailing}
    </View>
  );
}
