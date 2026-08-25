import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/features/onboarding/OnboardingProvider';
import { darkTheme } from '@/theme';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: darkTheme.colors.background },
          // Horizontal push reads as forward progress through a sequence,
          // where the root stack fade does not.
          animation: 'slide_from_right',
        }}
      />
    </OnboardingProvider>
  );
}
