import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { DeltaBadge } from '@/components/data-display/DeltaBadge';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { formatEventValue } from '@/features/assessment/display';
import { EventProgressRow } from '@/features/progress/EventProgressRow';
import { useProgressOverview } from '@/features/progress/useProgressOverview';
import { PERFORMANCE_CATEGORY_LABELS } from '@/domain/types';
import { formatDateStamp, formatDistance } from '@/lib/format';
import { useTheme } from '@/theme';

export default function ProgressScreen() {
  const theme = useTheme();
  const { state, reload } = useProgressOverview();

  // Logging an assessment happens on a screen pushed over this one, so the
  // overview has to refetch when it comes back into focus or the athlete
  // returns to stale numbers.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <Screen
      scroll
      testID="progress-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <Button
          label="Log Assessment"
          size="lg"
          onPress={() => router.push('/assessment/new')}
          testID="log-assessment"
        />
      }
    >
      <Text variant="title" accessibilityRole="header">
        Progress
      </Text>

      <AsyncBoundary state={state} onRetry={reload}>
        {(data) => (
          <>
            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="label" color="textTertiary">
                Readiness
              </Text>
              {data.readiness ? (
                <>
                  <Text
                    variant="metricXl"
                    accessibilityLabel={`Readiness ${data.readiness.overall} out of 100`}
                  >
                    {data.readiness.overall}
                  </Text>
                  {data.trend && data.trend.comparedTo !== null ? (
                    <DeltaBadge
                      delta={data.trend.delta}
                      caption={`LAST ${data.trend.windowDays} DAYS`}
                    />
                  ) : (
                    <Text variant="labelSm" color="textTertiary">
                      FIRST BASELINE
                    </Text>
                  )}
                </>
              ) : (
                <Text variant="body" color="textSecondary">
                  Log an assessment to generate your first score.
                </Text>
              )}
            </Card>

            {data.readinessHistory.length > 1 ? (
              <View>
                <SectionHeader title="Readiness Over Time" />
                <Card>
                  <LineChart
                    values={data.readinessHistory.map((snapshot) => snapshot.overall)}
                    formatValue={(value) => String(Math.round(value))}
                    accessibilityLabel={`Readiness across ${data.readinessHistory.length} assessments, currently ${data.readiness?.overall ?? 0}`}
                  />
                </Card>
              </View>
            ) : null}

            {data.gain || data.decline ? (
              <View>
                <SectionHeader title="Last 30 Days" />
                <Card padded={false}>
                  {data.gain ? (
                    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
                      <Text variant="labelSm" color="statusOnTarget">
                        Biggest gain
                      </Text>
                      <Text variant="headline">
                        {`${PERFORMANCE_CATEGORY_LABELS[data.gain.category]}  +${data.gain.delta ?? 0}`}
                      </Text>
                    </View>
                  ) : null}
                  {data.gain && data.decline ? <Divider /> : null}
                  {/* Declines are shown, not hidden. An athlete whose swim has
                      slipped needs telling while it is still a small gap. */}
                  {data.decline ? (
                    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
                      <Text variant="labelSm" color="statusOffTarget">
                        Slipped
                      </Text>
                      <Text variant="headline">
                        {`${PERFORMANCE_CATEGORY_LABELS[data.decline.category]}  ${data.decline.delta ?? 0}`}
                      </Text>
                      <Text variant="caption" color="textTertiary">
                        Worth a session before it becomes a gap.
                      </Text>
                    </View>
                  ) : null}
                </Card>
              </View>
            ) : null}

            {data.volume.length > 0 ? (
              <View>
                <SectionHeader
                  title="Weekly Volume"
                  trailing={
                    <Text variant="labelSm" color="textTertiary">
                      BY PROGRAMME WEEK
                    </Text>
                  }
                />
                <Card>
                  <BarChart
                    data={data.volume.map((week) => ({
                      label: String(week.weekNumber).padStart(2, '0'),
                      value: week.distanceMeters,
                      highlight: week.weekNumber === data.position?.weekNumber,
                    }))}
                    formatValue={(value) => formatDistance(value)}
                    accessibilityLabel={`Weekly training volume across ${data.volume.length} programme weeks`}
                  />
                </Card>
              </View>
            ) : null}

            {data.records.length === 0 ? (
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="label" color="textTertiary">
                  No results yet
                </Text>
                <Text variant="body" color="textSecondary">
                  Test whatever you can measure today. Even one event gives you a starting
                  point, and you can add the rest whenever you get to them.
                </Text>
              </Card>
            ) : (
              <>
                <View>
                  <SectionHeader
                    title="Personal Records"
                    trailing={
                      <Text variant="labelSm" color="textTertiary">
                        {`${data.records.length}`}
                      </Text>
                    }
                  />
                  <Card padded={false}>
                    {data.records.map((record, index) => (
                      <View key={record.event.id}>
                        {index > 0 ? <Divider /> : null}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: theme.spacing.md,
                            paddingVertical: theme.spacing.lg,
                            paddingHorizontal: theme.spacing.lg,
                          }}
                        >
                          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                            <Text variant="bodySm" color="textSecondary" numberOfLines={1}>
                              {record.event.name}
                            </Text>
                            <Text variant="monoSm" color="textTertiary">
                              {formatDateStamp(new Date(record.achievedAt))}
                            </Text>
                          </View>
                          <Text variant="metricMd">
                            {formatEventValue(record.event, record.value)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>

                <View>
                  <SectionHeader title="By Event" />
                  <Card padded={false}>
                    {data.progress.map((progress, index) => (
                      <View key={progress.event.id}>
                        {index > 0 ? <Divider /> : null}
                        <EventProgressRow
                          progress={progress}
                          onPress={() =>
                            router.push({
                              pathname: '/assessment/[eventId]',
                              params: { eventId: progress.event.id },
                            })
                          }
                        />
                      </View>
                    ))}
                  </Card>
                </View>
              </>
            )}
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
