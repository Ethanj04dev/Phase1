import { useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * The press response every touchable surface shares.
 *
 * A card that dims but does not move reads as a web page. A surface that
 * gives slightly under the finger and springs back reads as a physical
 * control, which is the whole register this interface is aiming for. One
 * hook, so every pressable in the app gives by exactly the same amount and
 * nothing feels like it came from a different product.
 *
 * Runs on the UI thread via Reanimated, per the architecture rules. The
 * press-in is a fast timing (a surface should give immediately, not wobble
 * on the way down); the release is a spring, because that is the part the
 * eye reads as physical.
 */
const PRESSED_SCALE = 0.97;
const PRESS_IN_MS = 80;

export interface PressScale {
  /** Spread onto the Pressable. */
  handlers: { onPressIn: () => void; onPressOut: () => void };
  /** Attach to an Animated.View wrapping (or being) the pressed surface. */
  style: StyleProp<ViewStyle>;
}

export function usePressScale(enabled = true): PressScale {
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withTiming(PRESSED_SCALE, { duration: PRESS_IN_MS });
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 320, mass: 0.6 });
  }, [scale]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: enabled ? scale.value : 1 }],
  }));

  // Reanimated's style type does not unify with ViewStyle in strict mode,
  // but Animated.View accepts both. Narrowing here keeps every call site free
  // of casts.
  const style = animated as unknown as StyleProp<ViewStyle>;

  return { handlers: { onPressIn, onPressOut }, style };
}

export { Animated };
