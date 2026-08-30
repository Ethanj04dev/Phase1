import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Text } from '@/components/primitives/Text';
import { findAssessmentDefinition } from '@/data/content/assessments';
import { useReviewQueue } from '@/features/verification/useReviewConsole';
import { formatDateStamp } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * The ground-truth queue: submitted attempts awaiting a verdict.
 *
 * This console holds interim authority while automated engines run in
 * shadow mode. Every verdict issued here is also a labeled sample the
 * automated systems will be validated against — which is why it exists at
 * all, and why it is not the product's long-term verifier.
 */
export default function ReviewQueueScreen() {
  const theme = useTheme();
  const { state, reload } = useReviewQueue();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <Screen testID="review-queue" contentContainerStyle={{ flex: 1 }}>
      <AsyncBoundary state={state} onRetry={reload}>
        {(queue) =>
          queue.length === 0 ? (
            <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.sm }}>
              <Text variant="headline">Queue is clear</Text>
              <Text variant="bodySm" color="textSecondary">
                No submitted assessments are waiting for ground truth.
              </Text>
            </View>
          ) : (
            <FlatList
              data={queue}
              keyExtractor={(item) => item.attemptId}
              contentContainerStyle={{
                paddingTop: theme.spacing.lg,
                paddingBottom: theme.spacing.xxl,
                gap: theme.spacing.md,
              }}
              renderItem={({ item }) => {
                const definition = findAssessmentDefinition(
                  item.definitionId,
                  item.definitionVersion,
                );
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${definition?.name ?? item.definitionId}`}
                    onPress={() => router.push(`/review/${item.attemptId}`)}
                    style={({ pressed }) => ({
                      gap: theme.spacing.xxs,
                      minHeight: theme.minTouchTarget,
                      padding: theme.spacing.lg,
                      borderRadius: theme.radii.md,
                      borderWidth: theme.hairline.width,
                      borderColor: theme.colors.border,
                      backgroundColor: pressed
                        ? theme.colors.surfacePressed
                        : theme.colors.surface,
                    })}
                  >
                    <Text variant="headline">
                      {definition?.name ?? item.definitionId}
                    </Text>
                    <Text variant="caption" color="textTertiary">
                      {item.submittedAt
                        ? `Submitted ${formatDateStamp(new Date(item.submittedAt))}`
                        : 'Submission time unknown'}
                    </Text>
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          )
        }
      </AsyncBoundary>
    </Screen>
  );
}
