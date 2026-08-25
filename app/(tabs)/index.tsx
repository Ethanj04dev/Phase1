import { router } from 'expo-router';
import { View } from 'react-native';

import { MetricTile } from '@/components/data-display/MetricTile';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Wordmark } from '@/components/layout/Wordmark';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { describeSession, totalEstimatedMinutes } from '@/domain/training/describe';
import { SESSION_MODALITY_LABELS } from '@/domain/training/types';
import {
  PERFORMANCE_CATEGORIES,
  PERFORMANCE_CATEGORY_LABELS,
  type PerformanceCategory,
} from '@/domain/types';
import { ReadinessHero } from '@/features/today/ReadinessHero';
import { useTodayDashboard } from '@/features/today/useTodayDashboard';
import { formatDateStamp, formatPercent, formatPosition } from '@/lib/format';
import { useTheme } from '@/theme';

/** Category scores below this read as the athlete falling behind the plan. */
const CAUTION_SCORE = 65;

function toneForScore(score: number): 'accent' | 'caution' {
  return score < CAUTION_SCORE ? 'caution' : 'accent';
}

export default function TodayScreen() {
  const theme = useTheme();
  const { state, reload } = useTodayDashboard();

  const dashboard = state.status === 'success' ? state.data : null;
  const hasSessionToday = Boolean(dashboard?.today && !dashboard.today.restDay);

  return (
    <Screen
      scroll
      testID="today-screen"
      contentContainerStyle={{ paddingBottom: theme.spacing.xxl, gap: theme.spacing.xl }}
      footer={
        hasSessionToday ? (
          <Button
            label="Begin Session"
            size="lg"
            accessibilityHint="Starts the first session of today"
            onPress={() => {
              if (dashboard?.today) {
                router.push({
                  pathname: '/workout/[dayId]',
                  params: { dayId: dashboard.today.id },
                });
              }
            }}
          />
        ) : undefined
      }
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(data) => (
          <>
            {/* Header: who this athlete is and where they are in the program. */}
            <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Wordmark />
                <Text variant="mono" color="textTertiary">
                  {formatDateStamp(new Date())}
                </Text>
              </View>
              <Text variant="title">{data.goal.shortName}</Text>
              {data.position ? (
                <Text variant="mono" color="textSecondary">
                  {`${formatPosition('WEEK', data.position.weekNumber)}  //  ${formatPosition(
                    'DAY',
                    data.position.dayNumber,
                  )}  //  ${data.position.weekFocus.toUpperCase()}`}
                </Text>
              ) : null}
            </View>

            <ReadinessHero readiness={data.readiness} trend={data.trend} />

            {/* Category breakdown: the "where am I weakest" answer. */}
            {data.readiness ? (
              <View>
                <SectionHeader
                  title="Categories"
                  trailing={
                    <Text variant="labelSm" color="textTertiary">
                      {`${formatPercent(data.readiness.coverage)} DATA`}
                    </Text>
                  }
                />
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.md,
                  }}
                >
                  {PERFORMANCE_CATEGORIES.map((category: PerformanceCategory) => {
                    const score = data.readiness?.categories[category];
                    if (score === undefined) {
                      return null;
                    }
                    return (
                      <View key={category} style={{ flexGrow: 1, flexBasis: '46%' }}>
                        <MetricTile
                          label={PERFORMANCE_CATEGORY_LABELS[category]}
                          value={String(score)}
                          progress={score / 100}
                          tone={toneForScore(score)}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Today: the "what do I do now" answer. */}
            <View>
              <SectionHeader
                title="Today"
                trailing={
                  data.today && !data.today.restDay ? (
                    <Text variant="labelSm" color="textTertiary">
                      {`${totalEstimatedMinutes(data.today.sessions)} MIN`}
                    </Text>
                  ) : undefined
                }
              />
              {data.today && !data.today.restDay ? (
                <Card padded={false}>
                  {data.today.sessions.map((session, index) => (
                    <View key={session.id}>
                      {index > 0 ? <Divider /> : null}
                      <View
                        style={{
                          padding: theme.spacing.lg,
                          gap: theme.spacing.xxs,
                        }}
                      >
                        <Text variant="labelSm" color="accent">
                          {SESSION_MODALITY_LABELS[session.modality]}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: theme.spacing.md,
                          }}
                        >
                          <Text variant="headline">{session.title}</Text>
                          <Text variant="mono" color="textSecondary">
                            {describeSession(session)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </Card>
              ) : (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="label" color="textTertiary">
                    Recovery
                  </Text>
                  <Text variant="body" color="textSecondary">
                    No session scheduled. Sleep and easy movement are the work today.
                  </Text>
                </Card>
              )}
            </View>

            {/* Consistency: the quiet third signal. */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <MetricTile label="Streak" value={String(data.streakDays)} unit="DAYS" />
              </View>
              <View style={{ flex: 1 }}>
                <MetricTile
                  label="This Week"
                  value={formatPercent(data.weeklyCompletion)}
                  progress={data.weeklyCompletion}
                />
              </View>
            </View>
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
