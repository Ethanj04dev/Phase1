import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

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
import { formatDateStamp } from '@/lib/format';
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
