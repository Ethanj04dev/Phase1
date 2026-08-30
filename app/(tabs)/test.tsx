import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { NavRow } from '@/components/layout/NavRow';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { RATING_LABEL } from '@/config/branding';
import { VERIFICATION_STATUS_LABELS } from '@/domain/attempt/types';
import { useTestCenter } from '@/features/attempt/useTestCenter';
import { formatDateStamp } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Test — the gateway into performance.
 *
 * The screen's structure IS the product's core distinction. Top: your
 * assessment — the complete protocol, performed as one sitting, the only
 * thing that ever generates a rating. Below: practice and training —
 * individual events, useful for preparation, never rating-bearing. A
 * candidate should never believe an isolated personal best moved their
 * official standing, so the two live in visibly different sections with the
 * rule written between them.
 */
export default function TestScreen() {
  const theme = useTheme();
  const { state, reload } = useTestCenter();

  // Logging an attempt happens on screens pushed over this one.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

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
        {({ definition, attempts, latestAttempt, testedEvents }) => (
          <>
            {/* THE ASSESSMENT — the competitive object. */}
            <View style={{ gap: theme.spacing.md }}>
              <Text variant="bodySm" color="textTertiary">
                YOUR ASSESSMENT
              </Text>
              {definition ? (
                <Card style={{ gap: theme.spacing.lg }}>
                  <View style={{ gap: theme.spacing.xxs }}>
                    <Text variant="labelSm" color="accent">
                      {definition.shortName}
                    </Text>
                    <Text variant="headline">{definition.name}</Text>
                    <Text variant="bodySm" color="textSecondary">
                      {`${definition.events.length} events, one sitting, in order. A complete assessment is the only thing that generates a rating.`}
                    </Text>
                  </View>

                  {latestAttempt ? (
                    <View style={{ gap: theme.spacing.xxs }}>
                      <Text variant="bodySm" color="textTertiary">
                        {`Latest — ${formatDateStamp(new Date(latestAttempt.occurredAt))}`}
                      </Text>
                      <Text variant="display">
                        {latestAttempt.estimatedRating !== null
                          ? `${latestAttempt.estimatedRating}`
                          : '—'}
                      </Text>
                      <Text variant="caption" color="textTertiary">
                        {latestAttempt.estimatedRating !== null
                          ? `Estimated ${RATING_LABEL.toLowerCase()} · ${VERIFICATION_STATUS_LABELS[latestAttempt.verificationStatus]} · Unranked`
                          : `${VERIFICATION_STATUS_LABELS[latestAttempt.verificationStatus]} · No rating — the attempt was not complete`}
                      </Text>
                    </View>
                  ) : (
                    <Text variant="bodySm" color="textSecondary">
                      No assessment logged yet. Your rating starts with your first complete
                      {` ${definition.shortName}.`}
                    </Text>
                  )}

                  <Button
                    label={`Log a practice ${definition.shortName}`}
                    onPress={() => router.push('/assessment/attempt')}
                    testID="log-attempt"
                  />
                  <Text variant="caption" color="textTertiary">
                    Verified assessments — the ones that can rank — arrive with verification.
                    Everything logged today is self-reported and stays out of the rankings.
                  </Text>
                </Card>
              ) : (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="headline">No assessment defined yet</Text>
                  <Text variant="bodySm" color="textSecondary">
                    Your pipeline does not have a modelled assessment protocol yet. Practice
                    events below still track your training; the assessment arrives when the
                    protocol can be modelled honestly.
                  </Text>
                </Card>
              )}
            </View>

            {/* ASSESSMENT HISTORY */}
            {attempts.length > 0 ? (
              <Card padded={false}>
                <NavRow
                  title="Assessment history"
                  subtitle="Every attempt, with its rating and status"
                  meta={`${attempts.length}`}
                  onPress={() => router.push('/assessment/history')}
                />
              </Card>
            ) : null}

            {/* PRACTICE & TRAINING — never rating-bearing. */}
            <View style={{ gap: theme.spacing.md }}>
              <Text variant="bodySm" color="textTertiary">
                PRACTICE & TRAINING
              </Text>
              <Card padded={false}>
                <NavRow
                  title="Log a training result"
                  subtitle="A single event you tested today — run, swim, calisthenics"
                  onPress={() => router.push('/assessment/new')}
                />
                <Divider />
                <NavRow
                  title="Guided test day"
                  subtitle="Events one at a time, protocol on screen, stopwatch for the timed work"
                  onPress={() => router.push('/assessment/test-day')}
                />
                <Divider />
                <NavRow
                  title="Results and records"
                  subtitle="Training history, personal records and trends"
                  meta={testedEvents > 0 ? `${testedEvents} events` : undefined}
                  onPress={() => router.push('/progress')}
                />
              </Card>
              <Text variant="caption" color="textTertiary">
                Training results build your history, records and readiness. They never
                generate a rating: an official performance is a complete assessment, not a
                collection of personal bests from different days.
              </Text>
            </View>
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
