import { useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { countdownLabel, countdownTo, parseSelectionDateInput } from '@/domain/target/countdown';
import { useAthleteProfile, useUpdateProfile } from '@/features/settings/useProfileSettings';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * The date the countdown counts to.
 *
 * Entered as text in the one unambiguous format rather than through a date
 * picker, because "03/04/2027" is March 4th or April 3rd depending on where
 * you grew up, and a countdown built on the wrong reading is confidently
 * wrong for months. The preview under the field shows the countdown the date
 * would produce, so a mistyped year is caught before it is saved.
 */
export default function SelectionDateScreen() {
  const theme = useTheme();
  const { state, reload } = useAthleteProfile();
  const { update, saving, error } = useUpdateProfile();

  const [text, setText] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="settings-selection-date"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(profile) => {
          if (!profile) {
            return (
              <Text variant="body" color="textSecondary">
                Complete onboarding first.
              </Text>
            );
          }

          const working = text ?? profile.selectionDate ?? '';
          const parsed = parseSelectionDateInput(working);
          const preview = parsed
            ? countdownLabel(countdownTo(parsed, new Date().toISOString()))
            : null;
          const invalid = touched && working.trim().length > 0 && parsed === null;
          const hasStored = Boolean(profile.selectionDate);

          const save = async () => {
            if (!parsed) return;
            const updated = await update({ selectionDate: parsed });
            if (updated) {
              goBack('/profile');
            }
          };

          const clear = async () => {
            const updated = await update({ selectionDate: null });
            if (updated) {
              goBack('/profile');
            }
          };

          return (
            <>
              <Text variant="body" color="textSecondary">
                Your selection or ship date, if you have one. It anchors the countdown on
                Today and Road to Ready. Like your milestones, it is your own record —
                Phase 1 cannot verify it and does not report it anywhere.
              </Text>

              <TextField
                label="Selection date"
                value={working}
                onChangeText={(next) => {
                  setText(next);
                  setTouched(true);
                }}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                helper={invalid ? undefined : 'For example 2027-03-04.'}
                error={
                  invalid
                    ? 'Enter the date as year-month-day, for example 2027-03-04.'
                    : undefined
                }
                testID="selection-date-input"
              />

              {/* The date read back before it is committed: a typo in the year
                  shows up here as an absurd countdown, not months later. */}
              {preview ? (
                <Card style={{ gap: theme.spacing.xxs }}>
                  <Text variant="bodySm" color="textTertiary">
                    That would read
                  </Text>
                  <Text variant="headline" color="accent">
                    {preview}
                  </Text>
                </Card>
              ) : null}

              {error ? (
                <Text variant="bodySm" color="statusOffTarget">
                  {error}
                </Text>
              ) : null}

              <View style={{ gap: theme.spacing.sm }}>
                <Button
                  label="Save date"
                  size="lg"
                  disabled={parsed === null || saving}
                  loading={saving}
                  onPress={save}
                  testID="save-selection-date"
                />
                {hasStored ? (
                  <Button
                    label="Remove date"
                    variant="ghost"
                    onPress={clear}
                    accessibilityHint="Clears your selection date and removes the countdown"
                  />
                ) : null}
              </View>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
