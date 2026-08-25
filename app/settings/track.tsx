import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { OptionCard } from '@/components/primitives/OptionCard';
import { Text } from '@/components/primitives/Text';
import { TRAINING_TRACKS, type TrainingTrackId } from '@/domain/athlete/types';
import {
  useAthleteProfile,
  useUpdateProfile,
} from '@/features/settings/useProfileSettings';
import { useTheme } from '@/theme';

export default function EditTrackScreen() {
  const theme = useTheme();
  const { state, reload } = useAthleteProfile();
  const { update, saving, error } = useUpdateProfile();
  const [selected, setSelected] = useState<TrainingTrackId | null>(null);

  const current = state.status === 'success' ? (state.data?.trackId ?? null) : null;
  const chosen = selected ?? current;
  const changed = chosen !== null && chosen !== current;

  const handleSave = async () => {
    if (!chosen) return;
    const updated = await update({ trackId: chosen });
    if (updated) {
      router.back();
    }
  };

  return (
    <Screen
      scroll
      testID="settings-track"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <View style={{ gap: theme.spacing.md }}>
          {error ? (
            <Text variant="caption" color="statusOffTarget">
              {error}
            </Text>
          ) : null}
          <Button
            label={changed ? 'Save Track' : 'No Changes'}
            size="lg"
            disabled={!changed}
            loading={saving}
            onPress={handleSave}
            testID="save-track"
          />
        </View>
      }
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {() => (
          <>
            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="labelSm" color="textTertiary">
                Switching restarts the block
              </Text>
              <Text variant="bodySm" color="textSecondary">
                Each track is an eight-week block. Changing track changes the sessions you
                see from here on; your logged workouts and assessments are kept.
              </Text>
            </Card>

            <View style={{ gap: theme.spacing.sm }}>
              {TRAINING_TRACKS.map((track) => (
                <OptionCard
                  key={track.id}
                  title={track.name}
                  subtitle={track.summary}
                  meta={track.id === current ? 'CURRENT' : undefined}
                  selected={chosen === track.id}
                  onPress={() => setSelected(track.id)}
                />
              ))}
            </View>

            {/* What each track actually asks of them, so the choice is informed
                rather than a guess from a one-line summary. */}
            {TRAINING_TRACKS.filter((track) => track.id === chosen).map((track) => (
              <Card key={track.id} style={{ gap: theme.spacing.md }}>
                <Text variant="labelSm" color="textTertiary">
                  {`${track.code} focuses on`}
                </Text>
                <View style={{ gap: theme.spacing.sm }}>
                  {track.focus.map((item) => (
                    <View
                      key={item}
                      style={{ flexDirection: 'row', gap: theme.spacing.md }}
                    >
                      <Text variant="mono" color="accent">
                        /
                      </Text>
                      <Text variant="bodySm" color="textSecondary" style={{ flex: 1 }}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ))}
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
