import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { isPersonalRecord } from '@/domain/assessment/records';
import type { AssessmentEventId } from '@/domain/assessment/types';
import { formatEventDelta, formatEventValue } from '@/features/assessment/display';
import { useEventHistory } from '@/features/assessment/useEventHistory';
import { formatDateStamp } from '@/lib/format';
import { useTheme } from '@/theme';

export default function EventHistoryScreen() {
  const theme = useTheme();
  const { eventId } = useLocalSearchParams<{ eventId: AssessmentEventId }>();
  const { state, reload } = useEventHistory(eventId);

  const title = state.status === 'success' ? state.data.event.name : 'History';

  return (
    <Screen
      scroll
      testID="assessment-history"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <Stack.Screen options={{ title }} />

      <AsyncBoundary
        state={state}
        onRetry={reload}
        isEmpty={(progress) => progress.history.length === 0}
        empty={{
          title: 'Not tested yet',
          body: 'Log a result for this event and its history will appear here.',
        }}
      >
        {(progress) => {
          const { event, first, latest, improvement, best, history } = progress;
          const improved = improvement !== null && improvement > 0;
          const declined = improvement !== null && improvement < 0;

          return (
            <>
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="labelSm" color="textTertiary">
                  {event.shortName}
                </Text>
                {latest ? (
                  <Text
                    variant="display"
                    accessibilityLabel={`Latest ${event.name}, ${formatEventValue(event, latest.value)}`}
                  >
                    {formatEventValue(event, latest.value)}
                  </Text>
                ) : null}
                {improvement === null ? (
                  <Text variant="labelSm" color="textTertiary">
                    FIRST TEST
                  </Text>
                ) : (
                  <Text
                    variant="labelSm"
                    style={{
                      color: improved
                        ? theme.colors.statusOnTarget
                        : declined
                          ? theme.colors.statusOffTarget
                          : theme.colors.textTertiary,
                    }}
                  >
                    {improvement === 0
                      ? 'NO CHANGE SINCE FIRST TEST'
                      : `${improved ? 'IMPROVED' : 'DOWN'} ${formatEventDelta(event, improvement)} SINCE FIRST TEST`}
                  </Text>
                )}
              </View>

              {history.length > 1 ? (
                <View>
                  <SectionHeader title="Trend" />
                  <Card>
                    <LineChart
                      values={history.map((entry) => entry.value)}
                      /*
                       * Time events plot inverted so a faster result rises.
                       * Without this, improving would send the line downward
                       * and read as decline at a glance.
                       */
                      invert={event.direction === 'lower_is_better'}
                      formatValue={(value) => formatEventValue(event, value)}
                      tone={improved ? 'onTarget' : 'accent'}
                      accessibilityLabel={`${event.name} across ${history.length} tests, from ${formatEventValue(event, first?.value ?? 0)} to ${formatEventValue(event, latest?.value ?? 0)}`}
                    />
                  </Card>
                </View>
              ) : null}

              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="labelSm" color="textTertiary">
                  Protocol
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  {event.protocol}
                </Text>
              </Card>

              {best ? (
                <View>
                  <SectionHeader title="Personal Record" />
                  <Card>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: theme.spacing.md,
                      }}
                    >
                      <Text variant="monoSm" color="textTertiary">
                        {formatDateStamp(new Date(best.achievedAt))}
                      </Text>
                      <Text variant="metricMd" color="accent">
                        {formatEventValue(event, best.value)}
                      </Text>
                    </View>
                  </Card>
                </View>
              ) : null}

              <View>
                <SectionHeader
                  title="All Results"
                  trailing={
                    <Text variant="labelSm" color="textTertiary">
                      {`${history.length}`}
                    </Text>
                  }
                />
                <Card padded={false}>
                  {/* Newest first: the most recent test is what the athlete
                      came here to check. */}
                  {[...history].reverse().map((entry, index, reversed) => {
                    const older = reversed[index + 1];
                    const change = older
                      ? event.direction === 'lower_is_better'
                        ? older.value - entry.value
                        : entry.value - older.value
                      : null;
                    const record = isPersonalRecord(event, entry, history);

                    return (
                      <View key={entry.id}>
                        {index > 0 ? <Divider /> : null}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: theme.spacing.md,
                            paddingVertical: theme.spacing.lg,
                            paddingHorizontal: theme.spacing.lg,
                          }}
                        >
                          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                            <Text variant="mono" color="textSecondary">
                              {formatDateStamp(new Date(entry.recordedAt))}
                            </Text>
                            {record ? (
                              <Text variant="labelSm" color="accent">
                                PERSONAL RECORD
                              </Text>
                            ) : null}
                          </View>

                          <View style={{ alignItems: 'flex-end', gap: theme.spacing.xxs }}>
                            <Text variant="metricMd">
                              {formatEventValue(event, entry.value)}
                            </Text>
                            {change === null || change === 0 ? null : (
                              <Text
                                variant="labelSm"
                                style={{
                                  color:
                                    change > 0
                                      ? theme.colors.statusOnTarget
                                      : theme.colors.statusOffTarget,
                                }}
                              >
                                {`${change > 0 ? '+' : '-'}${formatEventDelta(event, change)}`}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </View>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
