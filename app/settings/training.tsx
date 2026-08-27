import { useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { ChoiceRow } from '@/components/primitives/ChoiceRow';
import { Text } from '@/components/primitives/Text';
import type { AthleteProfile } from '@/domain/athlete/types';
import { EXPERIENCE_LEVEL_LABELS, type ExperienceLevel } from '@/domain/types';
import { DISCIPLINES, TRAINING_DAY_OPTIONS } from '@/features/settings/trainingBackground';
import { useAthleteProfile, useUpdateProfile } from '@/features/settings/useProfileSettings';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

type Draft = Pick<
  AthleteProfile,
  'runningExperience' | 'swimmingExperience' | 'ruckingExperience' | 'trainingDaysPerWeek'
>;

export default function EditTrainingScreen() {
  const theme = useTheme();
  const { state, reload } = useAthleteProfile();
  const { update, saving, error } = useUpdateProfile();
  const [draft, setDraft] = useState<Draft | null>(null);

  const profile = state.status === 'success' ? state.data : null;
  const current: Draft | null = profile
    ? {
        runningExperience: profile.runningExperience,
        swimmingExperience: profile.swimmingExperience,
        ruckingExperience: profile.ruckingExperience,
        trainingDaysPerWeek: profile.trainingDaysPerWeek,
      }
    : null;

  const working = draft ?? current;
  const changed =
    working !== null &&
    current !== null &&
    (Object.keys(working) as (keyof Draft)[]).some((key) => working[key] !== current[key]);

  const handleSave = async () => {
    if (!working) return;
    const updated = await update(working);
    if (updated) {
      goBack('/profile');
    }
  };

  return (
    <Screen
      scroll
      testID="settings-training"
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
            label={changed ? 'Save Changes' : 'No Changes'}
            size="lg"
            disabled={!changed}
            loading={saving}
            onPress={handleSave}
            testID="save-training"
          />
        </View>
      }
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {() =>
          working ? (
            <>
              <Text variant="body" color="textSecondary">
                Keep this current. It informs which track suits you, not your score.
              </Text>

              {DISCIPLINES.map((discipline) => (
                <View key={discipline.field}>
                  <SectionHeader title={discipline.label} />
                  <ChoiceRow
                    groupLabel={discipline.label}
                    options={discipline.levels}
                    selected={working[discipline.field]}
                    labelFor={(level: ExperienceLevel) => EXPERIENCE_LEVEL_LABELS[level]}
                    onSelect={(level) => setDraft({ ...working, [discipline.field]: level })}
                  />
                </View>
              ))}

              <View>
                <SectionHeader title="Training days per week" />
                <ChoiceRow
                  groupLabel="Training days per week"
                  options={TRAINING_DAY_OPTIONS}
                  selected={working.trainingDaysPerWeek}
                  labelFor={(days) => `${days} DAYS`}
                  onSelect={(days) => setDraft({ ...working, trainingDaysPerWeek: days })}
                />
              </View>
            </>
          ) : null
        }
      </AsyncBoundary>
    </Screen>
  );
}
