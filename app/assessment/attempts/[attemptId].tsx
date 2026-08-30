import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { RATING_LABEL } from '@/config/branding';
import { findAssessmentEvent } from '@/domain/assessment/types';
import {
  ATTEMPT_STATUS_LABELS,
  VERIFICATION_STATUS_LABELS,
} from '@/domain/attempt/types';
import { useAttemptDetail } from '@/features/attempt/useAttemptDetail';
import { formatDateStamp, formatDuration } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * One assessment attempt, exactly as performed.
 *
 * The rating block leads because it is what the athlete came for — but it
 * never renders without its labels. An estimate says estimated, self-reported
 * says self-reported, and nothing on this screen can be mistaken for a
 * ranking.
 */
export default function AttemptDetailScreen() {
  const theme = useTheme();
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { state, reload } = useAttemptDetail(attemptId ?? '');

  return (
    <Screen
      scroll
      testID="attempt-detail"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ attempt, definition, eventScores, bandLabel }) => {
          const pointsByEvent = new Map(
            eventScores.map((score) => [score.eventId, score.points]),
          );

          return (
            <>
              <View style={{ gap: theme.spacing.xxs }}>
                <Text variant="labelSm" color="accent">
                  {definition?.shortName ?? attempt.definitionId.toUpperCase()}
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {definition?.name ?? 'Assessment'}
                </Text>
                <Text variant="bodySm" color="textTertiary">
                  {`${formatDateStamp(new Date(attempt.occurredAt))} · Protocol v${attempt.definitionVersion}`}
                </Text>
              </View>

              <Card style={{ gap: theme.spacing.xxs }}>
                <Text variant="labelSm" color="textTertiary">
                  {`ESTIMATED ${RATING_LABEL.toUpperCase()}`}
                </Text>
                <Text
                  variant="display"
                  color={attempt.estimatedRating !== null ? 'accent' : 'textTertiary'}
                >
                  {attempt.estimatedRating !== null ? `${attempt.estimatedRating}` : '—'}
                </Text>
                <Text variant="caption" color="textTertiary">
                  {attempt.estimatedRating !== null
                    ? [bandLabel, VERIFICATION_STATUS_LABELS[attempt.verificationStatus], 'Unranked']
                        .filter(Boolean)
                        .join(' · ')
                    : `${ATTEMPT_STATUS_LABELS[attempt.status]} — a rating needs every event, performed as one sitting.`}
                </Text>
              </Card>

              <View>
                <Text
                  variant="bodySm"
                  color="textTertiary"
                  style={{ marginBottom: theme.spacing.md }}
                >
                  EVENTS AS PERFORMED
                </Text>
                <Card padded={false}>
                  {attempt.results.map((result, index) => {
                    const event = findAssessmentEvent(result.eventId);
                    const points = pointsByEvent.get(result.eventId);
                    return (
                      <View key={result.eventId}>
                        {index > 0 ? <Divider /> : null}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: theme.spacing.lg,
                            minHeight: theme.minTouchTarget,
                            paddingVertical: theme.spacing.md,
                            paddingHorizontal: theme.spacing.lg,
                          }}
                        >
                          <View style={{ gap: 2, flexShrink: 1 }}>
                            <Text variant="bodySm" color="textSecondary">
                              {event?.name ?? result.eventId}
                            </Text>
                            {points !== undefined ? (
                              <Text variant="caption" color="textTertiary">
                                {`${Math.round(points)} pts`}
                              </Text>
                            ) : null}
                          </View>
                          <Text variant="metricMd">
                            {event?.unit === 'seconds'
                              ? formatDuration(result.value)
                              : `${result.value}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </View>

              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="labelSm" color="textTertiary">
                  How this is treated
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  This is a self-reported practice assessment. The estimate shows roughly where
                  the performance stands; it never enters rankings. Verified assessments — the
                  ones that can rank — arrive with verification.
                </Text>
                {attempt.scoringConfigVersion !== null ? (
                  <Text variant="caption" color="textTertiary">
                    {`Scored under provisional scoring v${attempt.scoringConfigVersion}.`}
                  </Text>
                ) : null}
              </Card>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
