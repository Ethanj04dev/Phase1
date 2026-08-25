import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

export default function WorkoutLayout() {
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
      <Stack.Screen name="[dayId]" options={{ title: 'Session' }} />
      <Stack.Screen name="active" options={{ title: 'Session', headerBackVisible: false }} />
      <Stack.Screen
        name="complete"
        options={{ title: 'Complete', headerBackVisible: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
