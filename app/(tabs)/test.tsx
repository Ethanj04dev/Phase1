import { router } from 'expo-router';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { NavRow } from '@/components/layout/NavRow';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { latestResultByEvent } from '@/domain/assessment/types';
import { useTarget } from '@/features/target/useTarget';
import { useTheme } from '@/theme';

/**
 * Test — where performance enters Zero Phase.
 *
 * Everything here is real functionality carried over from the assessment
 * flows. What is honestly stated rather than faked: every result today is
 * self-reported, and self-reported results will never enter the rankings.
 * Verification is the next thing this tab grows.
 */
export default function TestScreen() {
  const theme = useTheme();
  const { state, reload } = useTarget();

  return (
    <Screen
      scroll
      testID="test-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <Text variant="title" accessibilityRole="header">
        Test
      </Text>

      <AsyncBoundary state={state} onRetry={reload}>
        {({ results }) => {
          const tested = latestResultByEvent(results).size;

          return (
            <>
              <Card padded={false}>
                <NavRow
                  title="Take the full assessment"
                  subtitle="One event at a time, protocol on screen, stopwatch for the timed work"
                  onPress={() => router.push('/assessment/test-day')}
                />
                <Divider />
                <NavRow
                  title="Log a single result"
                  subtitle="Quick entry for something you retested today"
                  onPress={() => router.push('/assessment/new')}
                />
                <Divider />
                <NavRow
                  title="Results and records"
                  subtitle="Your history, personal records and trends"
                  meta={tested > 0 ? `${tested} events` : undefined}
                  onPress={() => router.push('/progress')}
                />
              </Card>

              {/* The verification statement. Not a promise dressed as a
                  feature -- a plain description of how scores are treated. */}
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="bodySm" color="textTertiary">
                  How results are treated
                </Text>
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="body" color="textSecondary">
                    Every result in Zero Phase today is self-reported. Self-reported
                    results track your own progress and always will — but they will never
                    enter the rankings.
                  </Text>
                  <Text variant="bodySm" color="textSecondary">
                    Verified assessments are the next thing built here: evidence-backed
                    performances, reviewed before they count. When rankings launch, only
                    verified performances will move them.
                  </Text>
                </Card>
              </View>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
