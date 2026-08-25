import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

/**
 * Assessment screens push over the tabs with a native header. The header earns
 * its place here: it provides the back affordance and the iOS edge swipe for
 * free, on screens the athlete may want to abandon halfway.
 */
export default function AssessmentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: darkTheme.colors.background },
        headerTintColor: darkTheme.colors.accent,
        headerTitleStyle: {
          ...darkTheme.typography.headline,
          color: darkTheme.colors.textPrimary,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: darkTheme.colors.background },
      }}
    >
      <Stack.Screen name="new" options={{ title: 'Log Assessment' }} />
      <Stack.Screen name="[eventId]" options={{ title: 'History' }} />
    </Stack>
  );
}
