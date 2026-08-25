import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useRepositories } from '@/data/repositoryContext';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { useTheme } from '@/theme';

/**
 * Boot gate.
 *
 * The single place that decides where a launch lands. Keeping it a route
 * rather than logic inside the root layout means the decision happens once,
 * with a real loading state, and the auth stack can slot in here in M8 without
 * restructuring anything.
 */
export default function BootScreen() {
  const theme = useTheme();
  const { athlete } = useRepositories();

  const fetcher = useCallback(() => athlete.getCurrentProfile(), [athlete]);
  const { state, reload } = useAsyncResource(fetcher);

  // The native splash stays up until the destination is known, so the athlete
  // never sees an empty frame or a flash of the wrong screen. It is hidden on
  // failure too -- a stuck splash would be worse than a visible error.
  useEffect(() => {
    if (state.status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [state.status]);

  if (state.status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  if (state.status === 'error') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          padding: theme.screenGutter,
          gap: theme.spacing.lg,
        }}
      >
        <Text variant="label" color="statusOffTarget">
          Could not start
        </Text>
        <Text variant="body" color="textSecondary">
          {state.error.message}
        </Text>
        <Text
          variant="label"
          color="accent"
          onPress={reload}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          Try again
        </Text>
      </View>
    );
  }

  const profile = state.data;
  if (!profile || !profile.onboardingCompleted) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
