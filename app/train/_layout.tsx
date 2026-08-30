import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

/**
 * Training lives off the main navigation now. Zero Phase is not a workout
 * tracker; the programme exists to move a candidate's rating, and it is
 * reached from Home rather than owning a tab.
 */
export default function TrainLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Training' }} />
    </Stack>
  );
}
