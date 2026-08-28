import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme, type Theme } from '@/theme';

import { Text } from './Text';
import { Animated, usePressScale } from './usePressScale';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  accessibilityHint?: string;
  testID?: string;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };

interface VariantColors {
  background: string;
  backgroundPressed: string;
  border: string;
  label: string;
}

function variantColors(theme: Theme, variant: ButtonVariant): VariantColors {
  switch (variant) {
    case 'primary':
      // White, not the blue accent. The primary action is the single most
      // important thing on a screen, and on black nothing outranks white.
      // Blue stays reserved for signal so the two never compete.
      return {
        background: theme.colors.emphasis,
        backgroundPressed: theme.colors.emphasisPressed,
        border: theme.colors.emphasis,
        label: theme.colors.textOnEmphasis,
      };
    case 'secondary':
      return {
        background: theme.colors.surfaceElevated,
        backgroundPressed: theme.colors.surfacePressed,
        border: theme.colors.borderStrong,
        label: theme.colors.textPrimary,
      };
    case 'destructive':
      return {
        background: theme.colors.transparent,
        backgroundPressed: theme.colors.statusOffTargetSurface,
        border: theme.colors.statusOffTarget,
        label: theme.colors.statusOffTarget,
      };
    case 'ghost':
      return {
        background: theme.colors.transparent,
        backgroundPressed: theme.colors.surface,
        border: theme.colors.transparent,
        label: theme.colors.textSecondary,
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  leadingIcon,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const colors = variantColors(theme, variant);
  const inactive = disabled || loading;
  const press = usePressScale(!inactive);

  const container = (pressed: boolean): ViewStyle => ({
    height: HEIGHTS[size],
    minHeight: theme.minTouchTarget,
    paddingHorizontal: size === 'sm' ? theme.spacing.md : theme.spacing.xl,
    borderRadius: theme.radii.md,
    borderWidth: theme.hairline.width,
    borderColor: inactive ? theme.colors.border : colors.border,
    backgroundColor: inactive
      ? theme.colors.surface
      : pressed
        ? colors.backgroundPressed
        : colors.background,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
  });

  return (
    <Animated.View style={[press.style, fullWidth ? undefined : styles.hugContent]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        {...press.handlers}
        testID={testID}
        style={({ pressed }) => [styles.base, container(pressed)]}
      >
      {loading ? (
        <ActivityIndicator color={inactive ? theme.colors.textDisabled : colors.label} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {leadingIcon}
          <Text
            variant={size === 'sm' ? 'labelSm' : 'label'}
            style={{ color: inactive ? theme.colors.textDisabled : colors.label }}
          >
            {label}
          </Text>
        </View>
      )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hugContent: {
    alignSelf: 'flex-start',
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
