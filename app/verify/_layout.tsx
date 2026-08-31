import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

export default function VerifyLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Verified assessment' }} />
      <Stack.Screen name="run-lab" options={{ title: 'Run lab' }} />
      <Stack.Screen
        name="session"
        options={{
          title: 'Assessment session',
          // Leaving mid-session is a deliberate act (abandon), not a swipe.
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
