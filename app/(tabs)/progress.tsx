import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { DeltaBadge } from '@/components/data-display/DeltaBadge';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { PHASE1_TARGET_READINESS, READINESS_BAND_LABELS, readinessBand } from '@/domain/readiness/bands';
import { preparationDomain } from '@/domain/target/domains';
import type { RoadToReady } from '@/domain/target/roadToReady';
import { formatEventValue } from '@/features/assessment/display';
import { EventProgressRow } from '@/features/progress/EventProgressRow';
import { useProgressOverview } from '@/features/progress/useProgressOverview';
import { formatDateStamp, formatDistance, formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Progress answers "am I improving", on one scale.
 *
 * Every number here is now the Target-aware one, matching Today and the Target
 * tab. Snapshots recorded against a different Target, or before Targets
 * existed, are kept but are not plotted: they measure something else, and a
 * single line drawn through two scales shows a jump the athlete never made.
 */

function RoadProgress({ road }: { road: RoadToReady }) {
  const theme = useTheme();
  const scored = road.steps.filter((step) => step.kind !== 'unavailable');
  if (scored.length === 0) {
    return null;
  }

  return (
    <View>
      <Text variant="bodySm" color="textTertiary" style={{ marginBottom: theme.spacing.md }}>
        Road to ready
      </Text>
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="title">
          {`${road.atBenchmark} of ${scored.length} areas at benchmark`}
        </Text>
        <Text variant="bodySm" color="textSecondary">
          {road.focus
            ? `${preparationDomain(road.focus.domainId).label} is holding the most back.`
            : 'Nothing measured is holding your score back.'}
        </Text>
        <Text
          variant="caption"
          color="accent"
          accessibilityRole="button"
          onPress={() => router.push('/target/road')}
        >
          See the full list ›
        </Text>
      </Card>
    </View>
  );
}

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
          label="Log assessment"
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
        {(data) => {
          const score = data.readiness?.target?.overall ?? null;
          const band = score === null ? null : readinessBand(score);
          const coverage = data.readiness?.target?.coverage ?? null;

          return (
            <>
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="bodySm" color="textTertiary">
                  Readiness
                </Text>
                {score !== null && band ? (
                  <>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        gap: theme.spacing.md,
                      }}
                    >
                      <Text
                        variant="metricXl"
                        accessibilityLabel={`Readiness ${score} out of 100, ${READINESS_BAND_LABELS[band]}`}
                      >
                        {score}
                      </Text>
                      <Text variant="headline" color="accent">
                        {READINESS_BAND_LABELS[band]}
                      </Text>
                    </View>
                    {/* Only once there is something to compare against. A
                        first snapshot has no history, and "0" would state a
                        fact about progress nobody has had a chance to make. */}
                    {data.trend && data.trend.comparedTo !== null ? (
                      <DeltaBadge
                        delta={data.trend.delta}
                        caption={`last ${data.trend.windowDays} days`}
                      />
                    ) : (
                      <Text variant="bodySm" color="textTertiary">
                        First baseline
                      </Text>
                    )}
                    <Text variant="caption" color="textTertiary">
                      {`Phase 1 suggests ${PHASE1_TARGET_READINESS} before selection${
                        coverage === null
                          ? ''
                          : `. Based on ${formatPercent(coverage)} of what this target measures`
                      }.`}
                    </Text>
                  </>
                ) : data.readiness && data.target ? (
                  // A Target exists, but the stored score predates it. Showing
                  // the old number here would present one scale as the other.
                  <Text variant="body" color="textSecondary">
                    Your last score was recorded before this target was set up, on a
                    different set of weights. Log an assessment to score yourself against
                    {` ${data.target.name}`}.
                  </Text>
                ) : data.readiness ? (
                  // No Target definition at all. Saying which is better than
                  // showing a number from another scale as though it belonged.
                  <Text variant="body" color="textSecondary">
                    Your career does not have a full target definition yet, so there is no
                    target readiness to track. Your results and records below are unaffected.
                  </Text>
                ) : (
                  <Text variant="body" color="textSecondary">
                    Log an assessment to generate your first score.
                  </Text>
                )}
              </Card>

              {data.road ? <RoadProgress road={data.road} /> : null}

              {data.targetHistory.length > 1 ? (
                <View>
                  <Text
                    variant="bodySm"
                    color="textTertiary"
                    style={{ marginBottom: theme.spacing.md }}
                  >
                    Readiness over time
                  </Text>
                  <Card>
                    <LineChart
                      values={data.targetHistory.map(
                        (snapshot) => snapshot.target?.overall ?? 0,
                      )}
                      formatValue={(value) => String(Math.round(value))}
                      accessibilityLabel={`Readiness across ${data.targetHistory.length} assessments, currently ${score ?? 0}`}
                    />
                  </Card>
                  {data.offScaleCount > 0 ? (
                    <Text variant="caption" color="textTertiary" style={{ marginTop: theme.spacing.sm }}>
                      {data.offScaleCount === 1
                        ? '1 earlier score is not shown. It was recorded against a different set of weights and cannot be compared to these.'
                        : `${data.offScaleCount} earlier scores are not shown. They were recorded against a different set of weights and cannot be compared to these.`}
                    </Text>
                  ) : null}
                </View>
              ) : score !== null ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="headline">One score so far</Text>
                  <Text variant="body" color="textSecondary">
                    A trend needs two points. Retest in a few weeks and this becomes a line
                    worth reading.
                  </Text>
                </Card>
              ) : null}

              {data.gain || data.decline ? (
                <View>
                  <Text
                    variant="bodySm"
                    color="textTertiary"
                    style={{ marginBottom: theme.spacing.md }}
                  >
                    Last 30 days
                  </Text>
                  <Card padded={false}>
                    {data.gain ? (
                      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
                        <Text variant="bodySm" color="statusOnTarget">
                          Biggest gain
                        </Text>
                        <Text variant="headline">
                          {`${preparationDomain(data.gain.key).label}  +${data.gain.delta ?? 0}`}
                        </Text>
                      </View>
                    ) : null}
                    {data.gain && data.decline ? <Divider /> : null}
                    {/* Declines are shown, not hidden. An athlete whose swim has
                        slipped needs telling while it is still a small gap. */}
                    {data.decline ? (
                      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
                        <Text variant="bodySm" color="statusOffTarget">
                          Slipped
                        </Text>
                        <Text variant="headline">
                          {`${preparationDomain(data.decline.key).label}  ${data.decline.delta ?? 0}`}
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
                  <Text
                    variant="bodySm"
                    color="textTertiary"
                    style={{ marginBottom: theme.spacing.md }}
                  >
                    Weekly volume by programme week
                  </Text>
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
                  <Text variant="headline">No results yet</Text>
                  <Text variant="body" color="textSecondary">
                    Test whatever you can measure today. Even one event gives you a starting
                    point, and you can add the rest whenever you get to them.
                  </Text>
                </Card>
              ) : (
                <>
                  <View>
                    <Text
                      variant="bodySm"
                      color="textTertiary"
                      style={{ marginBottom: theme.spacing.md }}
                    >
                      {`Personal records · ${data.records.length}`}
                    </Text>
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
                    <Text
                      variant="bodySm"
                      color="textTertiary"
                      style={{ marginBottom: theme.spacing.md }}
                    >
                      By event
                    </Text>
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
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
