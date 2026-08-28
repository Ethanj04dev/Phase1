import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { isTimerRunning } from '@/domain/training/session';
import { SESSION_MODALITY_LABELS } from '@/domain/training/types';
import { BlockLogger } from '@/features/workout/BlockLogger';
import { useActiveSession, useElapsed } from '@/features/workout/useActiveSession';
import { formatDuration } from '@/lib/format';
import { sessionsIncludeWater, WaterSafetyNotice } from '@/features/training/WaterSafetyNotice';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

const RPE_OPTIONS = [4, 5, 6, 7, 8, 9, 10] as const;

export default function ActiveWorkoutScreen() {
  const theme = useTheme();
  const { dayId } = useLocalSearchParams<{ dayId?: string }>();
  const {
    session,
    day,
    results,
    loading,
    error,
    saving,
    toggleTimer,
    logEntry,
    clearEntry,
    setRpe,
    setNotes,
    finish,
  } = useActiveSession(dayId);

  const elapsed = useElapsed(session);
  const running = session ? isTimerRunning(session.segments) : false;

  const handleFinish = async () => {
    const result = await finish();
    if (result) {
      router.replace({
        pathname: '/workout/complete',
        params: { resultId: result.id },
      });
    }
  };

  if (loading) {
    return (
      <Screen testID="active-workout-loading">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (error || !session || !day) {
    return (
      <Screen testID="active-workout-error">
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Text variant="label" color="statusOffTarget">
            Cannot open session
          </Text>
          <Text variant="body" color="textSecondary">
            {error ?? 'That session is no longer available.'}
          </Text>
          <Button
            label="Go back"
            variant="secondary"
            fullWidth={false}
            onPress={() => goBack('/train')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="active-workout"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <Button
          label="Finish session"
          size="lg"
          loading={saving}
          onPress={handleFinish}
          testID="finish-session"
        />
      }
    >
      {/* The clock. Large, because it is read at arm's length mid-effort. */}
      <Card style={{ gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="label" color="textTertiary">
            Elapsed
          </Text>
          <Text variant="labelSm" color={running ? 'accent' : 'textTertiary'}>
            {running ? 'Running' : 'Paused'}
          </Text>
        </View>
        <Text variant="display" accessibilityLabel={`Elapsed time ${formatDuration(elapsed)}`}>
          {formatDuration(elapsed)}
        </Text>
        <Button
          label={running ? 'Pause' : 'Resume'}
          variant="secondary"
          onPress={toggleTimer}
          testID="toggle-timer"
        />
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="labelSm" color="textTertiary">
          In progress
        </Text>
        <Text variant="title" accessibilityRole="header">
          {day.title}
        </Text>
      </View>

      {sessionsIncludeWater(day.sessions) ? <WaterSafetyNotice /> : null}

      {day.sessions.map((workoutSession) => (
        <View key={workoutSession.id}>
          <SectionHeader
            title={SESSION_MODALITY_LABELS[workoutSession.modality]}
            trailing={
              <Text variant="labelSm" color="textTertiary">
                {workoutSession.title}
              </Text>
            }
          />
          <Card padded={false}>
            {workoutSession.blocks.map((block, index) => (
              <View key={block.id}>
                {index > 0 ? <Divider /> : null}
                <View style={{ padding: theme.spacing.lg }}>
                  <BlockLogger
                    block={block}
                    session={session}
                    results={results}
                    onLog={logEntry}
                    onClear={clearEntry}
                  />
                </View>
              </View>
            ))}
          </Card>
        </View>
      ))}

      <View>
        <SectionHeader title="How did it feel" />
        <Card style={{ gap: theme.spacing.lg }}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Session effort"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
          >
            {RPE_OPTIONS.map((value) => {
              const selected = session.rpe === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Effort ${value} out of 10`}
                  onPress={() => setRpe(value)}
                  style={{
                    flexGrow: 1,
                    minWidth: 44,
                    minHeight: theme.minTouchTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: theme.radii.md,
                    borderWidth: theme.hairline.width,
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                    backgroundColor: selected
                      ? theme.colors.accentSurface
                      : theme.colors.surfaceElevated,
                  }}
                >
                  <Text variant="mono" color={selected ? 'accent' : 'textSecondary'}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            accessibilityLabel="Session notes"
            multiline
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={theme.colors.textDisabled}
            selectionColor={theme.colors.accent}
            style={{
              ...theme.typography.body,
              color: theme.colors.textPrimary,
              minHeight: 88,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              borderWidth: theme.hairline.width,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.backgroundSunken,
              textAlignVertical: 'top',
            }}
            value={session.notes}
          />
        </Card>
      </View>

      <Text variant="caption" color="textTertiary">
        Everything is saved as you go. You can close the app and come back to this session.
      </Text>
    </Screen>
  );
}
