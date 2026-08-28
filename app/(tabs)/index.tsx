import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ReadinessGauge } from '@/components/charts/ReadinessGauge';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Wordmark } from '@/components/layout/Wordmark';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { READINESS_BAND_LABELS, readinessBand } from '@/domain/readiness/bands';
import { preparationDomain } from '@/domain/target/domains';
import type { RoadStep } from '@/domain/target/roadToReady';
import { describeSession, totalEstimatedMinutes } from '@/domain/training/describe';
import { SESSION_MODALITY_LABELS, type ResolvedWorkoutDay } from '@/domain/training/types';
import { roadStepInstruction } from '@/features/target/roadCopy';
import { useTodayDashboard } from '@/features/today/useTodayDashboard';
import { formatDateStamp, formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Today answers one question loudly: what do I do now.
 *
 * It used to be a dashboard -- readiness, a four-tile category grid, the
 * session, streak tiles -- five blocks of roughly equal weight, which meant
 * the athlete had to decide what to look at before they could act. The score
 * is not the thing to do at seven in the morning.
 *
 * So the session is the hero, the reason it matters comes second, and
 * readiness drops to a quiet line underneath. The category grid is gone
 * entirely: it lives on Target now, where weights and rationale give it the
 * context it always needed.
 */

/** The work itself. Everything else on this screen is subordinate to it. */
function SessionHero({ day }: { day: ResolvedWorkoutDay | null }) {
  const theme = useTheme();

  if (!day || day.restDay) {
    return (
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySm" color="textTertiary">
          Today
        </Text>
        <Text variant="title">Recovery</Text>
        <Text variant="body" color="textSecondary">
          No session scheduled. Sleep and easy movement are the work today, and skipping
          that is how the next hard week goes badly.
        </Text>
      </Card>
    );
  }

  const minutes = totalEstimatedMinutes(day.sessions);

  return (
    <Card padded={false}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xs }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <Text variant="bodySm" color="textTertiary">
            Today
          </Text>
          <Text variant="bodySm" color="textTertiary">
            {`${minutes} min`}
          </Text>
        </View>
        {day.sessions.map((session, index) => (
          <View key={session.id} style={{ gap: theme.spacing.xxs }}>
            {index > 0 ? (
              <Divider style={{ marginVertical: theme.spacing.md }} />
            ) : null}
            {/* A recovery session is titled "Recovery" and its modality is
                also "Recovery". Printing both reads as a rendering fault. */}
            {SESSION_MODALITY_LABELS[session.modality] === session.title ? null : (
              <Text variant="bodySm" color="accent">
                {SESSION_MODALITY_LABELS[session.modality]}
              </Text>
            )}
            <Text variant="metricMd">{session.title}</Text>
            <Text variant="body" color="textSecondary">
              {describeSession(session)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** One line on why today's work is worth doing, from the Road to Ready. */
function WhyItMatters({ focus }: { focus: RoadStep }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Road to ready. Your focus is ${preparationDomain(focus.domainId).label}`}
      onPress={() => router.push('/target/road')}
      style={{ gap: theme.spacing.xs }}
    >
      <Text variant="bodySm" color="textTertiary">
        {`Your focus: ${preparationDomain(focus.domainId).label.toLowerCase()}`}
      </Text>
      <Text variant="body" color="textSecondary">
        {roadStepInstruction(focus)}
      </Text>
      <Text variant="caption" color="accent">
        Road to ready ›
      </Text>
    </Pressable>
  );
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
            label="Begin session"
            size="lg"
            accessibilityHint="Starts the first session of today"
            onPress={() => {
              if (dashboard?.today) {
                router.push({
                  pathname: '/workout/active',
                  params: { dayId: dashboard.today.id },
                });
              }
            }}
          />
        ) : undefined
      }
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(data) => {
          const band = data.readiness ? readinessBand(data.readiness.overall) : null;

          return (
            <>
              <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Wordmark />
                  {/* Mono earns its place here: this is a stamp, not prose. */}
                  <Text variant="mono" color="textTertiary">
                    {formatDateStamp(new Date())}
                  </Text>
                </View>
                <Text variant="bodySm" color="textSecondary">
                  {data.position
                    ? `${data.target?.name ?? data.goal.name} · Week ${data.position.weekNumber} · Day ${data.position.dayNumber}`
                    : (data.target?.name ?? data.goal.name)}
                </Text>
              </View>

              <SessionHero day={data.today} />

              {data.road?.focus ? <WhyItMatters focus={data.road.focus} /> : null}

              {/* The other two questions the product owes an answer to, kept
                  deliberately quiet. Neither is what to act on right now. */}
              <View>
                <Divider />
                <View
                  style={{
                    flexDirection: 'row',
                    paddingTop: theme.spacing.lg,
                    gap: theme.spacing.lg,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      data.readiness && band
                        ? `Readiness ${data.readiness.overall} out of 100, ${READINESS_BAND_LABELS[band]}`
                        : 'Readiness not yet available'
                    }
                    onPress={() => router.push('/target')}
                    style={{ flex: 1.3, gap: theme.spacing.xxs, alignItems: 'flex-start' }}
                  >
                    <Text variant="caption" color="textTertiary">
                      Readiness
                    </Text>
                    {data.readiness && band ? (
                      // The honest gauge at pocket size: the same instrument
                      // as Target, quiet here because the session is the hero.
                      <ReadinessGauge
                        score={data.readiness.overall}
                        coverage={data.readiness.coverage}
                        size={96}
                        accessibilityLabel={`Readiness ${data.readiness.overall} out of 100, ${READINESS_BAND_LABELS[band]}`}
                      />
                    ) : (
                      <Text variant="bodySm" color="textSecondary">
                        Not yet
                      </Text>
                    )}
                  </Pressable>

                  <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                    <Text variant="caption" color="textTertiary">
                      Streak
                    </Text>
                    <Text variant="metricMd">{data.streakDays}</Text>
                    <Text variant="caption" color="textTertiary">
                      {data.streakDays === 1 ? 'day' : 'days'}
                    </Text>
                  </View>

                  <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                    <Text variant="caption" color="textTertiary">
                      This week
                    </Text>
                    <Text variant="metricMd">{formatPercent(data.weeklyCompletion)}</Text>
                    <Text variant="caption" color="textTertiary">
                      complete
                    </Text>
                  </View>
                </View>
              </View>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
