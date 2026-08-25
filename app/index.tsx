import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useRepositories } from '@/data/repositoryContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { useTheme } from '@/theme';

/**
 * Boot gate.
 *
 * The single place that decides where a launch lands, in this order:
 *
 *   auth still resolving  -> hold the splash
 *   no backend configured -> local storage, straight to the profile check
 *   signed out            -> sign in
 *   signed in             -> profile check, then onboarding or the app
 *
 * Keeping it a route rather than logic in the root layout means the decision
 * happens once, with a real loading state, and the auth step slotted in here
 * without restructuring anything.
 */
export default function BootScreen() {
  const theme = useTheme();
  const { status } = useAuth();
  const { athlete } = useRepositories();

  // Only meaningful once auth has settled; until then the repositories may
  // still be the local set and the answer would be about the wrong athlete.
  const ready = status === 'signed_in' || status === 'disabled';

  const fetcher = useCallback(() => athlete.getCurrentProfile(), [athlete]);
  const { state, reload } = useAsyncResource(fetcher);

  const resolving = status === 'loading' || (ready && state.status === 'loading');

  // Hidden on failure too: a stuck splash is worse than a visible error.
  useEffect(() => {
    if (!resolving) {
      void SplashScreen.hideAsync();
    }
  }, [resolving]);

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  if (status === 'signed_out') {
    return <Redirect href="/auth/sign-in" />;
  }

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
