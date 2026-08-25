import { Stack } from 'expo-router';

import { darkTheme } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: darkTheme.colors.background },
        animation: 'fade',
      }}
    />
  );
}
