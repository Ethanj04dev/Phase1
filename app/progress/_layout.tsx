import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

/** Personal results and records, reached from the Test tab and Profile. */
export default function ProgressLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Results' }} />
    </Stack>
  );
}
