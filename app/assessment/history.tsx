import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Text } from '@/components/primitives/Text';
import { findAssessmentDefinition } from '@/data/content/assessments';
import {
  ATTEMPT_STATUS_LABELS,
  VERIFICATION_STATUS_LABELS,
  type AssessmentAttempt,
} from '@/domain/attempt/types';
import { useTestCenter } from '@/features/attempt/useTestCenter';
import { formatDateStamp } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Every assessment attempt, newest first. Append-only history: nothing here
 * is ever overwritten, because the story of May's 681 becoming August's 826
 * is the product working.
 */

function AttemptRow({ attempt }: { attempt: AssessmentAttempt }) {
  const theme = useTheme();
  const definition = findAssessmentDefinition(attempt.definitionId, attempt.definitionVersion);

  const statusLine = [
    VERIFICATION_STATUS_LABELS[attempt.verificationStatus],
    attempt.status === 'completed' ? null : ATTEMPT_STATUS_LABELS[attempt.status],
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Assessment on ${formatDateStamp(new Date(attempt.occurredAt))}, ${
        attempt.estimatedRating !== null
          ? `estimated rating ${attempt.estimatedRating}`
          : 'no rating'
      }, ${statusLine}`}
      onPress={() => router.push(`/assessment/attempts/${attempt.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        minHeight: theme.minTouchTarget,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.md,
        borderWidth: theme.hairline.width,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
      })}
    >
      <View style={{ gap: theme.spacing.xxs, flexShrink: 1 }}>
        <Text variant="headline">
          {`${formatDateStamp(new Date(attempt.occurredAt))} — ${definition?.shortName ?? attempt.definitionId}`}
        </Text>
        <Text variant="caption" color="textTertiary">
          {statusLine}
        </Text>
      </View>
      <Text
        variant="metricMd"
        color={attempt.estimatedRating !== null ? 'textPrimary' : 'textTertiary'}
      >
        {attempt.estimatedRating !== null ? `${attempt.estimatedRating}` : '—'}
      </Text>
    </Pressable>
  );
}

export default function AttemptHistoryScreen() {
  const theme = useTheme();
  const { state, reload } = useTestCenter();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <Screen testID="assessment-history" contentContainerStyle={{ flex: 1 }}>
      <AsyncBoundary state={state} onRetry={reload}>
        {({ attempts }) =>
          attempts.length === 0 ? (
            <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.sm }}>
              <Text variant="headline">No assessments yet</Text>
              <Text variant="bodySm" color="textSecondary">
                Your first complete assessment starts your history.
              </Text>
            </View>
          ) : (
            <FlatList
              data={attempts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <AttemptRow attempt={item} />}
              contentContainerStyle={{
                paddingTop: theme.spacing.lg,
                paddingBottom: theme.spacing.xxl,
                gap: theme.spacing.md,
              }}
              showsVerticalScrollIndicator={false}
            />
          )
        }
      </AsyncBoundary>
    </Screen>
  );
}
