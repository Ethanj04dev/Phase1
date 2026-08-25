import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { totalEstimatedMinutes } from '@/domain/training/describe';
import { SESSION_MODALITY_LABELS } from '@/domain/training/types';
import { BlockRow } from '@/features/training/BlockRow';
import { useWorkoutDay } from '@/features/training/useWorkoutDay';
import { useTheme } from '@/theme';

export default function WorkoutOverviewScreen() {
  const theme = useTheme();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { state, reload } = useWorkoutDay(dayId);

  const hasSessions = state.status === 'success' && state.data.day.sessions.length > 0;

  return (
    <Screen
      scroll
      testID="workout-overview"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        hasSessions ? (
          <Button
            label="Begin Session"
            size="lg"
            accessibilityHint="Starts logging this session"
            onPress={() => {
              // The active workout lands in M5. Until then this screen is the
              // prescription, not the logger.
            }}
            testID="begin-session"
          />
        ) : undefined
      }
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ day, results }) => (
          <>
            <Stack.Screen options={{ title: day.title }} />

            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="labelSm" color="textTertiary">
                {day.restDay
                  ? 'REST DAY'
                  : `${totalEstimatedMinutes(day.sessions)} MIN · ${day.sessions.length} ${
                      day.sessions.length === 1 ? 'SESSION' : 'SESSIONS'
                    }`}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {day.title}
              </Text>
              <Text variant="body" color="textSecondary">
                {day.description}
              </Text>
            </View>

            {day.sessions.map((session) => (
              <View key={session.id}>
                <SectionHeader
                  title={SESSION_MODALITY_LABELS[session.modality]}
                  trailing={
                    <Text variant="labelSm" color="textTertiary">
                      {`${session.estimatedMinutes} MIN`}
                    </Text>
                  }
                />
                <Card padded={false}>
                  <View style={{ padding: theme.spacing.lg }}>
                    <Text variant="headline">{session.title}</Text>
                  </View>
                  {session.blocks.map((block) => (
                    <View key={block.id}>
                      <Divider />
                      <View style={{ padding: theme.spacing.lg }}>
                        <BlockRow block={block} results={results} />
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            ))}

            {day.restDay ? (
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="label" color="textTertiary">
                  Nothing scheduled
                </Text>
                <Text variant="body" color="textSecondary">
                  Rest is programmed, not earned back later. Sleep well and eat properly.
                </Text>
              </Card>
            ) : null}
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
