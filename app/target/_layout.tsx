import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

export default function TargetDetailLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Your pipeline' }} />
      <Stack.Screen name="road" options={{ title: 'Road to ready' }} />
      <Stack.Screen name="evidence" options={{ title: 'How it is computed' }} />
      <Stack.Screen name="fitness" options={{ title: 'Fitness' }} />
      <Stack.Screen name="skills" options={{ title: 'Skills' }} />
      <Stack.Screen name="demands" options={{ title: 'Physical demands' }} />
      <Stack.Screen name="milestones" options={{ title: 'Milestones' }} />
      <Stack.Screen name="pipeline" options={{ title: 'Pipeline' }} />
      <Stack.Screen name="intel" options={{ title: 'Career intel' }} />
    </Stack>
  );
}
