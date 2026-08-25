import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

export default function SettingsLayout() {
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
      <Stack.Screen name="goal" options={{ title: 'Objective' }} />
      <Stack.Screen name="track" options={{ title: 'Training Track' }} />
      <Stack.Screen name="training" options={{ title: 'Training Background' }} />
    </Stack>
  );
}
