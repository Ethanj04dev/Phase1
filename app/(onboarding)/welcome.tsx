import { router } from 'expo-router';
import { View } from 'react-native';

import { GridBackdrop } from '@/components/layout/GridBackdrop';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { branding } from '@/config/branding';
import { shortDisclaimer } from '@/config/disclaimers';
import { useTheme } from '@/theme';

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <Screen
      testID="onboarding-welcome"
      footer={
        <View style={{ gap: theme.spacing.lg }}>
          <Button
            label="Get started"
            size="lg"
            onPress={() => router.push('/goal')}
            testID="get-started"
          />
          <Text variant="caption" color="textTertiary" align="center">
            {shortDisclaimer}
          </Text>
        </View>
      }
    >
      <GridBackdrop divisions={10} opacity={0.3} />

      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <Text variant="display" accessibilityRole="header">
          {branding.wordmark.lead}{' '}
          <Text variant="display" color="accent">
            {branding.wordmark.numeral}
          </Text>
        </Text>
        <Text variant="title" color="textSecondary">
          {branding.tagline}
        </Text>
      </View>
    </Screen>
  );
}
