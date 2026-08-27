import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface SectionHeaderProps {
  title: string;
  /** Right-aligned metadata — a count, a date, a status. */
  trailing?: ReactNode;
  /**
   * Thin rule running from the label to the trailing slot.
   *
   * Off by default now. A rule on every section drew the eye to the dividers
   * rather than to the content, which is the same complaint that took borders
   * off the navigable rows.
   */
  rule?: boolean;
}

export function SectionHeader({ title, trailing, rule = false }: SectionHeaderProps) {
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
      <Text variant="bodySm" color="textTertiary" accessibilityRole="header">
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
