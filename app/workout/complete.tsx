import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { MetricTile } from '@/components/data-display/MetricTile';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { GridBackdrop } from '@/components/layout/GridBackdrop';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { useWorkoutSummary } from '@/features/workout/useWorkoutSummary';
import { formatDistance, formatDuration, formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

export default function WorkoutCompleteScreen() {
  const theme = useTheme();
  const { resultId } = useLocalSearchParams<{ resultId: string }>();
  const { state, reload } = useWorkoutSummary(resultId);

  return (
    <Screen
      scroll
      testID="workout-complete"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <Button
          label="Done"
          size="lg"
          onPress={() => router.dismissAll()}
          testID="complete-done"
        />
      }
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(summary) => (
          <>
            <Card padded={false} style={{ paddingVertical: theme.spacing.xxl }}>
              <GridBackdrop divisions={8} opacity={0.35} />
              <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
                <Text variant="label" color="accent">
                  Session Complete
                </Text>
                <Text
                  variant="display"
                  accessibilityLabel={`Duration ${formatDuration(summary.result.durationSeconds)}`}
                >
                  {formatDuration(summary.result.durationSeconds)}
                </Text>
                {summary.day ? (
                  <Text variant="bodySm" color="textSecondary">
                    {summary.day.title}
                  </Text>
                ) : null}
              </View>
            </Card>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
              <View style={{ flexGrow: 1, flexBasis: '46%' }}>
                <MetricTile
                  label="Volume"
                  value={
                    summary.distanceMeters > 0 ? formatDistance(summary.distanceMeters) : '--'
                  }
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: '46%' }}>
                <MetricTile
                  label="Logged"
                  value={`${summary.entries.length}`}
                  unit={`OF ${summary.prescribedEntries}`}
                  progress={
                    summary.prescribedEntries > 0
                      ? summary.entries.length / summary.prescribedEntries
                      : undefined
                  }
                />
              </View>
            </View>

            {/* Only shown when something was actually judged against a target.
                A session with no targets has nothing to report here. */}
            {summary.targeted > 0 ? (
              <View>
                <SectionHeader title="Against Target" />
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="metricLg">{`${summary.onTarget} / ${summary.targeted}`}</Text>
                  <Text variant="bodySm" color="textSecondary">
                    {`${formatPercent(summary.onTarget / summary.targeted)} of your timed reps landed inside the window.`}
                  </Text>
                </Card>
              </View>
            ) : null}

            <View>
              <SectionHeader title="Effort" />
              <Card style={{ gap: theme.spacing.sm }}>
                {summary.result.rpe === null ? (
                  <Text variant="body" color="textSecondary">
                    No effort recorded.
                  </Text>
                ) : (
                  <>
                    <Text variant="metricLg">{`${summary.result.rpe} / 10`}</Text>
                    <Text variant="labelSm" color="textTertiary">
                      PERCEIVED EXERTION
                    </Text>
                  </>
                )}
                {summary.result.notes ? (
                  <Text variant="bodySm" color="textSecondary">
                    {summary.result.notes}
                  </Text>
                ) : null}
              </Card>
            </View>
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
