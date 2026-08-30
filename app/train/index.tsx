import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { totalEstimatedMinutes } from '@/domain/training/describe';
import { SESSION_MODALITY_LABELS, type ResolvedWorkoutDay } from '@/domain/training/types';
import { dayState, weekProgress, type DayState } from '@/domain/training/weekState';
import {
  DAY_STATE_COLORS,
  DAY_STATE_LABELS,
  dayRailColor,
  weekProgressSummary,
} from '@/features/training/dayStateDisplay';
import { useTrainingWeek } from '@/features/training/useTrainingWeek';
import { useTheme } from '@/theme';

/**
 * The programme, a week at a time.
 *
 * Every day used to render identically, so a week was impossible to read:
 * nothing distinguished what had been done from what had slipped past. The
 * state now comes from logged workouts rather than from the calendar alone,
 * and it is carried by a word before it is carried by a colour.
 */

function WeekChip({
  week,
  selected,
  isCurrent,
  onPress,
}: {
  week: number;
  selected: boolean;
  isCurrent: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Week ${week}${isCurrent ? ', current week' : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 52,
        minHeight: theme.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.md,
        // Fill rather than outline. Outlining every chip gave a row of equally
        // weighted boxes with no sense of which one was live.
        backgroundColor: selected
          ? theme.colors.accentSurface
          : pressed
            ? theme.colors.surfacePressed
            : theme.colors.surface,
      })}
    >
      <Text variant="bodySm" color={selected ? 'accent' : 'textSecondary'}>
        {week}
      </Text>
      {/* Marks where the athlete actually is, which stays visible while they
          browse other weeks. */}
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: isCurrent ? theme.colors.accent : theme.colors.transparent,
        }}
      />
    </Pressable>
  );
}

function DayRow({ day, state }: { day: ResolvedWorkoutDay; state: DayState }) {
  const theme = useTheme();
  // A rest day is titled "Rest" and its state is also "Rest". Printing both
  // reads as a rendering fault rather than as information.
  const stateLabel = DAY_STATE_LABELS[state];
  const label = stateLabel === day.title ? null : stateLabel;
  const rail = dayRailColor(state);
  const minutes = day.sessions.length > 0 ? totalEstimatedMinutes(day.sessions) : null;

  const detail = [
    ...day.sessions.map((session) => SESSION_MODALITY_LABELS[session.modality]),
    minutes === null ? null : `${minutes} min`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Day ${day.dayNumber}, ${day.title}${label ? `, ${label}` : ''}`}
      disabled={day.restDay}
      onPress={() =>
        router.push({ pathname: '/workout/[dayId]', params: { dayId: day.id } })
      }
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        minHeight: theme.minTouchTarget,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.transparent,
      })}
    >
      <View
        style={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: 2,
          backgroundColor: rail ? theme.colors[rail] : theme.colors.transparent,
        }}
      />
      {/* Mono earns its place: this is an index, read as data. */}
      <Text variant="mono" color="textTertiary">
        {String(day.dayNumber).padStart(2, '0')}
      </Text>

      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text
          variant="headline"
          color={day.restDay ? 'textTertiary' : 'textPrimary'}
          numberOfLines={1}
        >
          {day.title}
        </Text>
        {detail ? (
          <Text variant="bodySm" color="textTertiary" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>

      {/* The state, in words. Colour is support and never the only signal. */}
      {label ? (
        <Text variant="bodySm" color={DAY_STATE_COLORS[state]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function TrainScreen() {
  const theme = useTheme();
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const { state, reload } = useTrainingWeek(selectedWeek);

  return (
    <Screen
      scroll
      testID="train-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(data) => {
          const currentWeek = data.position?.weekNumber ?? null;
          const currentDay = data.position?.dayNumber ?? null;

          const states = data.days.map((day) =>
            dayState({
              day,
              weekNumber: data.weekNumber,
              currentWeek,
              currentDay,
              completed: data.completedDayIds.has(day.id),
            }),
          );
          const summary = weekProgressSummary(weekProgress(states));

          return (
            <>
              <View style={{ gap: theme.spacing.xs }}>
                <Text variant="bodySm" color="textTertiary">
                  {data.program.program.name}
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {`Week ${data.weekNumber}`}
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  {data.focus}
                </Text>
                {summary ? (
                  <Text variant="bodySm" color="textTertiary">
                    {summary}
                  </Text>
                ) : null}
              </View>

              {/* Horizontal because a programme of eight weeks in a column
                  would push the actual training off the screen. */}
              <View style={{ gap: theme.spacing.md }}>
                <Text variant="bodySm" color="textTertiary">
                  {`${data.program.program.durationWeeks} week programme`}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: theme.spacing.sm }}
                >
                  {Array.from(
                    { length: data.program.program.durationWeeks },
                    (_, index) => index + 1,
                  ).map((week) => (
                    <WeekChip
                      key={week}
                      week={week}
                      selected={week === data.weekNumber}
                      isCurrent={week === currentWeek}
                      onPress={() => setSelectedWeek(week)}
                    />
                  ))}
                </ScrollView>
              </View>

              <Card padded={false}>
                {data.days.map((day, index) => (
                  <View key={day.id}>
                    {index > 0 ? <Divider /> : null}
                    <DayRow day={day} state={states[index] ?? 'upcoming'} />
                  </View>
                ))}
              </Card>

              <Text variant="caption" color="textTertiary">
                {data.program.program.description}
              </Text>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
