import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import type { NewAssessmentResult } from '@/data/repositories/types';
import { ASSESSMENT_EVENTS, type AssessmentEventId } from '@/domain/assessment/types';
import { PERFORMANCE_CATEGORY_LABELS, type PerformanceCategory } from '@/domain/types';
import { AssessmentField } from '@/features/assessment/AssessmentField';
import { useLogAssessment } from '@/features/assessment/useLogAssessment';
import { useTheme } from '@/theme';

const CATEGORY_ORDER: readonly PerformanceCategory[] = [
  'calisthenics',
  'running',
  'swimming',
  'rucking',
];

type EntryDraft = Partial<Record<AssessmentEventId, number>>;

export default function NewAssessmentScreen() {
  const theme = useTheme();
  const { log, submitting, error } = useLogAssessment();
  const [entries, setEntries] = useState<EntryDraft>({});

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

  const payload = useMemo<NewAssessmentResult[]>(
    () =>
      Object.entries(entries).flatMap(([eventId, value]) =>
        value === undefined ? [] : [{ eventId: eventId as AssessmentEventId, value }],
      ),
    [entries],
  );

  const handleSave = async () => {
    const outcome = await log(payload);
    if (outcome) {
      // Back to Progress, which refetches on focus and shows the new numbers.
      router.back();
    }
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="assessment-new"
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
            label={
              payload.length === 0
                ? 'Enter a result'
                : `Save ${payload.length} ${payload.length === 1 ? 'result' : 'results'}`
            }
            size="lg"
            disabled={payload.length === 0}
            loading={submitting}
            onPress={handleSave}
            testID="save-assessment"
          />
        </View>
      }
    >
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textTertiary">
          Retest
        </Text>
        <Text variant="body" color="textSecondary">
          Enter only what you tested today. Anything you leave blank keeps its previous result,
          and your readiness updates as soon as you save.
        </Text>
      </Card>

      {CATEGORY_ORDER.map((category) => {
        const events = ASSESSMENT_EVENTS.filter((event) => event.category === category);
        if (events.length === 0) {
          return null;
        }
        return (
          <View key={category}>
            <SectionHeader title={PERFORMANCE_CATEGORY_LABELS[category]} />
            <View style={{ gap: theme.spacing.xl }}>
              {events.map((event, index) => (
                <View key={event.id} style={{ gap: theme.spacing.xl }}>
                  {index > 0 ? <Divider /> : null}
                  <AssessmentField
                    event={event}
                    value={entries[event.id]}
                    onChange={(value) => setValue(event.id, value)}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
