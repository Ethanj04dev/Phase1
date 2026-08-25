import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. Off for screens that manage their own list. */
  scroll?: boolean;
  /** Apply the standard horizontal gutter. Off for edge-to-edge lists. */
  gutter?: boolean;
  edges?: readonly Edge[];
  /** Pinned action area, kept out of the scroll view and above the home indicator. */
  footer?: ReactNode;
  sunken?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Lifts content and the pinned footer clear of the keyboard. Required on any
   * screen with a text input, or the field being typed into can end up hidden
   * behind the keyboard.
   */
  avoidKeyboard?: boolean;
  testID?: string;
}

export function Screen({
  children,
  scroll = false,
  gutter = true,
  edges = ['top'],
  footer,
  sunken = false,
  contentContainerStyle,
  avoidKeyboard = false,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingHorizontal: gutter ? theme.screenGutter : 0,
  };

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padding, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Content under a pinned footer needs room to clear it.
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, contentContainerStyle]}>{children}</View>
  );

  const content = (
    <>
      {body}
      {footer ? (
        <View
          style={[
            padding,
            {
              paddingTop: theme.spacing.lg,
              paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
              borderTopWidth: theme.hairline.width,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView
      edges={edges}
      testID={testID}
      style={[
        styles.flex,
        {
          backgroundColor: sunken ? theme.colors.backgroundSunken : theme.colors.background,
        },
      ]}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          // iOS insets the view; Android already resizes the window, so
          // applying padding there would double-count the keyboard.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
