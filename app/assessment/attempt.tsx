import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { RATING_LABEL } from '@/config/branding';
import { scoringConfigFor } from '@/data/content/assessments';
import { findAssessmentEvent, type AssessmentEventId } from '@/domain/assessment/types';
import type { AssessmentDefinition } from '@/domain/attempt/definition';
import { isAttemptComplete } from '@/domain/attempt/types';
import { parseSelectionDateInput } from '@/domain/pipeline/countdown';
import { ratingBand } from '@/domain/scoring/config';
import { scoreAttempt } from '@/domain/scoring/score';
import { AssessmentField } from '@/features/assessment/AssessmentField';
import {
  buildAttemptResults,
  useLogAttempt,
  type AttemptEntries,
} from '@/features/attempt/useLogAttempt';
import { useTestCenter } from '@/features/attempt/useTestCenter';
import { useTheme } from '@/theme';

/**
 * Log a complete practice assessment: one sitting, every event, in order.
 *
 * The live estimate appears only once every event has a value, because a
 * rating describes a complete performance and nothing less. Partial entries
 * can still be saved — honestly, as an incomplete attempt with no rating.
 */

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function AttemptForm({ definition }: { definition: AssessmentDefinition }) {
  const theme = useTheme();
  const { save, saving, error } = useLogAttempt();

  const [entries, setEntries] = useState<AttemptEntries>({});
  const [dateText, setDateText] = useState(todayIso());
  const [dateTouched, setDateTouched] = useState(false);

  const setValue = useCallback((eventId: AssessmentEventId, value: number | null) => {
    setEntries((current) => {
      const next = { ...current };
      if (value === null) {
        delete next[eventId];
      } else {
        next[eventId] = value;
      }
      return next;
    });
  }, []);

  const results = useMemo(
    () => buildAttemptResults(definition, entries),
    [definition, entries],
  );
  const complete = isAttemptComplete(definition, results);
  const config = scoringConfigFor(definition.id, definition.version);
  const preview = complete && config ? scoreAttempt(config, results) : null;
  const previewBand =
    preview?.rating != null && config ? ratingBand(config, preview.rating) : null;

  const parsedDate = parseSelectionDateInput(dateText);
  const dateInvalid = dateTouched && parsedDate === null;

  const handleSave = async () => {
    if (!parsedDate) {
      setDateTouched(true);
      return;
    }
    // Noon local avoids the date sliding a day when rendered in other zones.
    const occurredAt = new Date(`${parsedDate}T12:00:00`).toISOString();
    const recorded = await save(definition, entries, occurredAt, null);
    if (recorded) {
      router.replace(`/assessment/attempts/${recorded.id}`);
    }
  };

  const saveLabel =
    results.length === 0
      ? 'Enter your results'
      : complete
        ? 'Save assessment'
        : 'Save as incomplete';

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="assessment-attempt"
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
          {!complete && results.length > 0 ? (
            <Text variant="caption" color="textTertiary">
              Incomplete assessments are kept as history but never generate a rating.
            </Text>
          ) : null}
          <Button
            label={saveLabel}
            size="lg"
            disabled={results.length === 0 || dateInvalid}
            loading={saving}
            onPress={handleSave}
            testID="save-attempt"
          />
        </View>
      }
    >
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="labelSm" color="accent">
          {definition.shortName}
        </Text>
        <Text variant="headline">{definition.name}</Text>
        {definition.protocolNotes.map((note) => (
          <Text key={note} variant="bodySm" color="textSecondary">
            {note}
          </Text>
        ))}
        <Text variant="caption" color="textTertiary">
          This logs an assessment you performed as one continuous session. Do not combine
          results from different days — that performance never happened.
        </Text>
      </Card>

      <TextField
        label="Date performed"
        value={dateText}
        onChangeText={(next) => {
          setDateText(next);
          setDateTouched(true);
        }}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        error={dateInvalid ? 'Enter the date as year-month-day, for example 2026-08-29.' : undefined}
        testID="attempt-date"
      />

      {definition.events.map((spec, index) => {
        const event = findAssessmentEvent(spec.eventId);
        if (!event) {
          return null;
        }
        return (
          <View key={spec.eventId} style={{ gap: theme.spacing.xl }}>
            {index > 0 ? <Divider /> : null}
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="labelSm" color="textTertiary">
                {`EVENT ${index + 1} OF ${definition.events.length}`}
              </Text>
              <AssessmentField
                event={event}
                value={entries[spec.eventId]}
                onChange={(value) => setValue(spec.eventId, value)}
              />
            </View>
          </View>
        );
      })}

      {preview?.rating != null ? (
        <Card style={{ gap: theme.spacing.xxs }}>
          <Text variant="labelSm" color="textTertiary">
            {`ESTIMATED ${RATING_LABEL.toUpperCase()}`}
          </Text>
          <Text variant="display" color="accent">
            {`${preview.rating}`}
          </Text>
          <Text variant="caption" color="textTertiary">
            {[previewBand?.label, 'Self-reported', 'Not verified', 'Unranked']
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

export default function LogAttemptScreen() {
  const theme = useTheme();
  const { state, reload } = useTestCenter();

  if (state.status === 'success' && state.data.definition) {
    return <AttemptForm definition={state.data.definition} />;
  }

  return (
    <Screen testID="assessment-attempt" contentContainerStyle={{ paddingTop: theme.spacing.lg }}>
      <AsyncBoundary state={state} onRetry={reload}>
        {({ definition }) =>
          definition ? null : (
            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="headline">No assessment defined yet</Text>
              <Text variant="bodySm" color="textSecondary">
                Your pipeline does not have a modelled assessment protocol yet, so there is
                nothing to log here. Individual training results still work from the Test tab.
              </Text>
            </Card>
          )
        }
      </AsyncBoundary>
    </Screen>
  );
}
