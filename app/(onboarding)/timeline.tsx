import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { StepIndicator } from '@/components/layout/StepIndicator';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { countdownLabel, countdownTo, parseSelectionDateInput } from '@/domain/pipeline/countdown';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { useTheme } from '@/theme';

/**
 * The optional timeline step.
 *
 * A candidate with fourteen weeks to selection trains differently from one
 * with forty, so the date is worth asking for up front — but most athletes
 * early in the process do not have one, and skipping is the honest answer
 * then. The skip is a first-class button, not a buried link, because
 * inventing a date to get past a gate would poison the countdown from day
 * one.
 */
export default function TimelineScreen() {
  const theme = useTheme();
  const { draft, setSelectionDate } = useOnboarding();

  const [text, setText] = useState(draft.selectionDate ?? '');
  const [touched, setTouched] = useState(false);

  const parsed = parseSelectionDateInput(text);
  const preview = parsed
    ? countdownLabel(countdownTo(parsed, new Date().toISOString()))
    : null;
  const invalid = touched && text.trim().length > 0 && parsed === null;

  const advance = (date: string | null) => {
    setSelectionDate(date);
    router.push('/baseline');
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="onboarding-timeline"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {parsed ? (
            <Button
              label="Continue"
              size="lg"
              onPress={() => advance(parsed)}
              testID="timeline-continue"
            />
          ) : (
            <Button
              label="I don't have a date yet"
              size="lg"
              variant="secondary"
              onPress={() => advance(null)}
              testID="timeline-skip"
            />
          )}
        </View>
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <StepIndicator step={4} total={5} />
        <Text variant="title" accessibilityRole="header">
          Do you have a selection date?
        </Text>
        <Text variant="body" color="textSecondary">
          If you know when you ship or when selection starts, the whole app anchors to
          it — fourteen weeks out trains differently from forty. If you do not have one
          yet, skip this; you can add it any time from your profile.
        </Text>
      </View>

      <TextField
        label="Selection date"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setTouched(true);
        }}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        helper={invalid ? undefined : 'For example 2027-03-04.'}
        error={
          invalid ? 'Enter the date as year-month-day, for example 2027-03-04.' : undefined
        }
        testID="timeline-date-input"
      />

      {/* The date read back before it is committed: a typo in the year shows
          up here as an absurd countdown, not months later. */}
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

      <Text variant="caption" color="textTertiary">
        Like everything here, this is your own record. Zero Phase cannot verify it and does
        not report it anywhere.
      </Text>
    </Screen>
  );
}
