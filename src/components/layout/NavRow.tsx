import { Pressable, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface NavRowProps {
  title: string;
  /** One line of what is behind this row. Skipped when the title is enough. */
  subtitle?: string;
  /** Short status on the right, e.g. a count or a state. */
  meta?: string;
  /** Draws the meta in the accent colour, for anything needing attention. */
  metaAccent?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}

/**
 * A row that leads somewhere.
 *
 * Deliberately borderless. The previous design outlined every element, which
 * gave a screen full of equally-weighted boxes and no hierarchy. Here the
 * surface and the spacing do the separating, and the only strong mark is the
 * title.
 */
export function NavRow({
  title,
  subtitle,
  meta,
  metaAccent = false,
  onPress,
  accessibilityHint,
}: NavRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.minTouchTarget,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.transparent,
      })}
    >
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="textTertiary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {meta ? (
        <Text variant="bodySm" color={metaAccent ? 'accent' : 'textTertiary'}>
          {meta}
        </Text>
      ) : null}

      <Text variant="body" color="textTertiary">
        ›
      </Text>
    </Pressable>
  );
}
