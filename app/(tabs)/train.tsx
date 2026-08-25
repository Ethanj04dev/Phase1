import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { totalEstimatedMinutes } from '@/domain/training/describe';
import { SESSION_MODALITY_LABELS } from '@/domain/training/types';
import { useTrainingWeek } from '@/features/training/useTrainingWeek';
import { formatPosition } from '@/lib/format';
import { useTheme } from '@/theme';

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
          const currentWeek = data.position?.weekNumber ?? 1;
          const currentDay = data.position?.dayNumber ?? 0;
          const isCurrentWeek = data.weekNumber === currentWeek;

          return (
            <>
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="labelSm" color="textTertiary">
                  {data.program.program.name.toUpperCase()}
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {formatPosition('Week', data.weekNumber)}
                </Text>
                <Text variant="mono" color="textSecondary">
                  {data.focus.toUpperCase()}
                </Text>
              </View>

              {/* Week selector. Horizontal because eight weeks in a column
                  would push the actual training off the screen. */}
              <View>
                <SectionHeader
                  title="Programme"
                  trailing={
                    <Text variant="labelSm" color="textTertiary">
                      {`${data.program.program.durationWeeks} WEEKS`}
                    </Text>
                  }
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: theme.spacing.sm }}
                >
                  {Array.from(
                    { length: data.program.program.durationWeeks },
                    (_, index) => index + 1,
                  ).map((week) => {
                    const selected = week === data.weekNumber;
                    const isCurrent = week === currentWeek;
                    return (
                      <Pressable
                        key={week}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Week ${week}${isCurrent ? ', current week' : ''}`}
                        onPress={() => setSelectedWeek(week)}
                        style={({ pressed }) => ({
                          minWidth: 56,
                          minHeight: theme.minTouchTarget,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: theme.spacing.md,
                          borderRadius: theme.radii.md,
                          borderWidth: theme.hairline.width,
                          borderColor: selected
                            ? theme.colors.accent
                            : isCurrent
                              ? theme.colors.borderStrong
                              : theme.colors.border,
                          backgroundColor: selected
                            ? theme.colors.accentSurface
                            : pressed
                              ? theme.colors.surfacePressed
                              : theme.colors.surface,
                        })}
                      >
                        <Text
                          variant="mono"
                          color={selected ? 'accent' : 'textSecondary'}
                        >
                          {String(week).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View>
                <SectionHeader
                  title="Week"
                  trailing={
                    isCurrentWeek ? (
                      <Text variant="labelSm" color="accent">
                        CURRENT
                      </Text>
                    ) : undefined
                  }
                />
                <Card padded={false}>
                  {data.days.map((day, index) => {
                    const isToday = isCurrentWeek && day.dayNumber === currentDay;
                    return (
                      <View key={day.id}>
                        {index > 0 ? <Divider /> : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Day ${day.dayNumber}, ${day.title}${isToday ? ', today' : ''}`}
                          disabled={day.restDay}
                          onPress={() =>
                            router.push({
                              pathname: '/workout/[dayId]',
                              params: { dayId: day.id },
                            })
                          }
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: theme.spacing.md,
                            paddingVertical: theme.spacing.lg,
                            paddingHorizontal: theme.spacing.lg,
                            minHeight: theme.minTouchTarget,
                            backgroundColor: pressed
                              ? theme.colors.surfacePressed
                              : theme.colors.transparent,
                          })}
                        >
                          <View
                            style={{
                              width: 3,
                              alignSelf: 'stretch',
                              borderRadius: 2,
                              backgroundColor: isToday
                                ? theme.colors.accent
                                : theme.colors.transparent,
                            }}
                          />
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
                            {day.sessions.length > 0 ? (
                              <Text variant="labelSm" color="textTertiary" numberOfLines={1}>
                                {day.sessions
                                  .map((s) => SESSION_MODALITY_LABELS[s.modality])
                                  .join(' · ')}
                              </Text>
                            ) : null}
                          </View>
                          {day.sessions.length > 0 ? (
                            <Text variant="monoSm" color="textTertiary">
                              {`${totalEstimatedMinutes(day.sessions)}M`}
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </Card>
              </View>

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
