import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ReadinessGauge } from '@/components/charts/ReadinessGauge';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { NavRow } from '@/components/layout/NavRow';
import { Screen } from '@/components/layout/Screen';
import { Wordmark } from '@/components/layout/Wordmark';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { READINESS_BAND_LABELS, readinessBand } from '@/domain/readiness/bands';
import { countdownLabel, countdownTo } from '@/domain/pipeline/countdown';
import { preparationDomain } from '@/domain/pipeline/domains';
import { describeSession, totalEstimatedMinutes } from '@/domain/training/describe';
import { roadStepInstruction } from '@/features/pipeline/roadCopy';
import { useTodayDashboard } from '@/features/today/useTodayDashboard';
import { formatDateStamp, formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Home — the candidate's competitive dashboard.
 *
 * Zero Phase is not a workout tracker, so Home no longer opens on a workout.
 * It opens on who the candidate is, what they are counting down to, where
 * they stand, and what is holding them back. Training appears at the bottom
 * as the means, not the message.
 *
 * Everything on this screen is real. Rank and the 0–1000 rating do not exist
 * yet, so they are not here — no placeholder numbers, no mock leaderboard.
 * The readiness gauge is the real instrument that the rating will replace.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { state, reload } = useTodayDashboard();

  return (
    <Screen
      scroll
      testID="home-screen"
      contentContainerStyle={{ paddingBottom: theme.spacing.xxl, gap: theme.spacing.xl }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(data) => {
          const band = data.readiness ? readinessBand(data.readiness.overall) : null;
          const countdown = countdownLabel(
            countdownTo(data.profile.selectionDate, new Date().toISOString()),
          );
          const edge = data.readiness?.strongestDomain ?? null;
          const focus = data.road?.focus ?? null;
          const session = data.today && !data.today.restDay ? data.today : null;

          return (
            <>
              {/* Identity: who this candidate is and what the clock says. */}
              <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.md }}>
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
                <Text variant="title" accessibilityRole="header">
                  {`${data.pipeline?.shortName ?? data.goal.shortName} candidate`}
                </Text>
                {countdown ? (
                  <Text variant="bodySm" color="accent">
                    {countdown}
                  </Text>
                ) : null}
              </View>

              {/* Where they stand. The honest gauge; the rating replaces this
                  scale when verification exists to back it. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  data.readiness && band
                    ? `Readiness ${data.readiness.overall} out of 100, ${READINESS_BAND_LABELS[band]}. Opens your pipeline`
                    : 'Readiness not yet measured. Opens your pipeline'
                }
                onPress={() => router.push('/pipeline')}
              >
                <Card style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
                  {data.readiness && band ? (
                    <>
                      <ReadinessGauge
                        score={data.readiness.overall}
                        coverage={data.readiness.coverage}
                        caption={READINESS_BAND_LABELS[band]}
                        size={180}
                        accessibilityLabel={`Readiness ${data.readiness.overall} out of 100, ${READINESS_BAND_LABELS[band]}`}
                      />
                      {data.readiness.coverage < 1 ? (
                        <Text variant="caption" color="textTertiary" align="center">
                          {`Measured on ${formatPercent(data.readiness.coverage)} of your pipeline. The open section is what you have not tested.`}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text variant="body" color="textSecondary">
                      Take an assessment to put a number on where you stand.
                    </Text>
                  )}
                </Card>
              </Pressable>

              {/* Edge and weakness: the competitive reading of the same data. */}
              {edge || focus ? (
                <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                  {edge ? (
                    <Card style={{ flex: 1, gap: theme.spacing.xxs }}>
                      <Text variant="caption" color="textTertiary">
                        Your edge
                      </Text>
                      <Text variant="headline">{preparationDomain(edge).label}</Text>
                      <Text variant="caption" color="textTertiary">
                        {`${data.readiness?.domains[edge] ?? ''}`}
                      </Text>
                    </Card>
                  ) : null}
                  {focus ? (
                    <Card
                      onPress={() => router.push('/pipeline/road')}
                      accessibilityLabel={`Biggest opportunity: ${preparationDomain(focus.domainId).label}. Opens road to ready`}
                      style={{ flex: 1, gap: theme.spacing.xxs }}
                    >
                      <Text variant="caption" color="textTertiary">
                        Biggest opportunity
                      </Text>
                      <Text variant="headline" color="accent">
                        {preparationDomain(focus.domainId).label}
                      </Text>
                      <Text variant="caption" color="textTertiary" numberOfLines={2}>
                        {roadStepInstruction(focus)}
                      </Text>
                    </Card>
                  ) : null}
                </View>
              ) : null}

              {/* The loop, stated where the candidate starts every day. */}
              <Card padded={false}>
                <NavRow
                  title="Test"
                  subtitle="Assessments are how performance enters Zero Phase"
                  onPress={() => router.push('/assessment/test-day')}
                />
              </Card>

              {/* Training: the means, not the message. */}
              <View>
                <Divider />
                <NavRow
                  title={session ? "Today's training" : 'Training'}
                  subtitle={
                    session
                      ? `${session.sessions.map((s) => s.title).join(' + ')} · ${totalEstimatedMinutes(session.sessions)} min`
                      : data.today?.restDay
                        ? 'Recovery day — rest is programmed, not earned back later'
                        : 'Your programme, week by week'
                  }
                  onPress={() => router.push('/train')}
                />
                {session && session.sessions[0] ? (
                  <Text
                    variant="caption"
                    color="textTertiary"
                    style={{ paddingHorizontal: theme.spacing.lg }}
                  >
                    {describeSession(session.sessions[0])}
                  </Text>
                ) : null}
              </View>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
