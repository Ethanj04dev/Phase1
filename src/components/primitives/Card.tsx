import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '@/theme';

import { Animated, usePressScale } from './usePressScale';

export interface CardProps extends ViewProps {
  /** `elevated` lifts the surface one step for cards sitting on cards. */
  elevated?: boolean;
  padded?: boolean;
  bordered?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

function baseStyle(
  theme: Theme,
  elevated: boolean,
  padded: boolean,
  bordered: boolean,
): ViewStyle {
  return {
    backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: bordered ? theme.hairline.width : 0,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.lg : 0,
    overflow: 'hidden',
  };
}

/**
 * The machined edge: a 1px strip along the top of the plate catching light.
 * Inset past the corner radius so the rounded corners stay clean. This is the
 * treatment that separates surfaces by light rather than by line weight, per
 * the design north star.
 */
function EdgeHighlight() {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: theme.radii.lg,
        right: theme.radii.lg,
        height: 1,
        backgroundColor: theme.colors.edgeHighlight,
      }}
    />
  );
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
  const press = usePressScale(Boolean(onPress));

  if (onPress) {
    return (
      <Animated.View style={press.style}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          {...press.handlers}
          style={({ pressed }) => [
            surface,
            pressed ? { backgroundColor: theme.colors.surfacePressed } : null,
            style as ViewStyle,
          ]}
        >
          {children}
          <EdgeHighlight />
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={[surface, style]} {...rest}>
      {children}
      <EdgeHighlight />
    </View>
  );
}
