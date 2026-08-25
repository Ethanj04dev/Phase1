import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '@/theme';

export interface CardProps extends ViewProps {
  /** `elevated` lifts the surface one step for cards sitting on cards. */
  elevated?: boolean;
  padded?: boolean;
  bordered?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

function baseStyle(theme: Theme, elevated: boolean, padded: boolean, bordered: boolean): ViewStyle {
  return {
    backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: bordered ? theme.hairline.width : 0,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.lg : 0,
    overflow: 'hidden',
  };
}

export function Card({
  elevated = false,
  padded = true,
  bordered = true,
  onPress,
  style,
  children,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const theme = useTheme();
  const surface = baseStyle(theme, elevated, padded, bordered);

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          surface,
          pressed ? { backgroundColor: theme.colors.surfacePressed } : null,
          style as ViewStyle,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={[surface, style]} {...rest}>
      {children}
    </View>
  );
}
