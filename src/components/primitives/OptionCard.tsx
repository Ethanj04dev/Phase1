import { Pressable, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface OptionCardProps {
  title: string;
  subtitle?: string;
  /** Right-aligned short code, e.g. an abbreviation or duration. */
  meta?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * The selection primitive behind every onboarding choice. Selection is
 * signalled three ways — border, tinted surface and an explicit marker — so
 * it never depends on colour alone.
 */
export function OptionCard({
  title,
  subtitle,
  meta,
  selected,
  onPress,
  disabled = false,
}: OptionCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.minTouchTarget + theme.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.md,
        borderWidth: theme.hairline.width,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        backgroundColor: selected
          ? theme.colors.accentSurface
          : pressed
            ? theme.colors.surfacePressed
            : theme.colors.surface,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: selected ? 5 : theme.hairline.width,
          borderColor: selected ? theme.colors.accent : theme.colors.borderStrong,
          backgroundColor: theme.colors.background,
        }}
      />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text variant="mono" color="textTertiary">
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}
