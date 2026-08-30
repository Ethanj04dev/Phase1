import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

export default function ReviewLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Ground truth' }} />
      <Stack.Screen name="[attemptId]" options={{ title: 'Review' }} />
    </Stack>
  );
}
