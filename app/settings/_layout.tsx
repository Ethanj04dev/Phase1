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
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="identity" options={{ title: 'Identity' }} />
      <Stack.Screen name="goal" options={{ title: 'Pipeline' }} />
      <Stack.Screen name="track" options={{ title: 'Training track' }} />
      <Stack.Screen name="training" options={{ title: 'Training background' }} />
      <Stack.Screen name="selection-date" options={{ title: 'Selection date' }} />
    </Stack>
  );
}
