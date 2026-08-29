import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StepIndicator } from '@/components/layout/StepIndicator';
import { Button } from '@/components/primitives/Button';
import { ChoiceRow } from '@/components/primitives/ChoiceRow';
import { Text } from '@/components/primitives/Text';
import { EXPERIENCE_LEVEL_LABELS } from '@/domain/types';
import { DISCIPLINES, TRAINING_DAY_OPTIONS } from '@/features/settings/trainingBackground';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { useTheme } from '@/theme';

export default function ExperienceScreen() {
  const theme = useTheme();
  const { draft, setExperience, setTrainingDays, canAdvance } = useOnboarding();

  return (
    <Screen
      scroll
      testID="onboarding-experience"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <Button
          label="Continue"
          size="lg"
          disabled={!canAdvance('experience')}
          accessibilityHint={
            canAdvance('experience') ? undefined : 'Answer every question to continue'
          }
          onPress={() => router.push('/timeline')}
          testID="experience-continue"
        />
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <StepIndicator step={2} total={4} />
        <Text variant="title" accessibilityRole="header">
          Your training background
        </Text>
        <Text variant="body" color="textSecondary">
          Answer honestly. This decides where your programme starts, not how capable you are.
        </Text>
      </View>

      {DISCIPLINES.map((discipline) => (
        <View key={discipline.field}>
          <SectionHeader title={discipline.label} />
          <ChoiceRow
            groupLabel={discipline.label}
            options={discipline.levels}
            selected={draft[discipline.field]}
            labelFor={(level) => EXPERIENCE_LEVEL_LABELS[level]}
            onSelect={(level) => setExperience(discipline.field, level)}
          />
        </View>
      ))}

      <View>
        <SectionHeader title="Training days per week" />
        <ChoiceRow
          groupLabel="Training days per week"
          options={TRAINING_DAY_OPTIONS}
          selected={draft.trainingDaysPerWeek}
          labelFor={(days) => `${days} days`}
          onSelect={setTrainingDays}
        />
      </View>
    </Screen>
  );
}
