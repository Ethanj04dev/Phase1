import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StepIndicator } from '@/components/layout/StepIndicator';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { EXPERIENCE_LEVEL_LABELS, type ExperienceLevel } from '@/domain/types';
import {
  useOnboarding,
  type ExperienceField,
} from '@/features/onboarding/OnboardingProvider';
import { useTheme } from '@/theme';

interface DisciplineConfig {
  field: ExperienceField;
  label: string;
  levels: readonly ExperienceLevel[];
}

/**
 * Running omits "none" deliberately: everyone can run to some degree, whereas
 * an athlete may genuinely never have swum or carried a ruck.
 */
const DISCIPLINES: readonly DisciplineConfig[] = [
  {
    field: 'runningExperience',
    label: 'Running',
    levels: ['beginner', 'intermediate', 'advanced'],
  },
  {
    field: 'swimmingExperience',
    label: 'Swimming',
    levels: ['none', 'beginner', 'intermediate', 'advanced'],
  },
  {
    field: 'ruckingExperience',
    label: 'Rucking',
    levels: ['none', 'beginner', 'intermediate', 'advanced'],
  },
];

const TRAINING_DAY_OPTIONS = [3, 4, 5, 6] as const;

interface ChoiceRowProps<T extends string | number> {
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  labelFor: (value: T) => string;
  groupLabel: string;
}

function ChoiceRow<T extends string | number>({
  options,
  selected,
  onSelect,
  labelFor,
  groupLabel,
}: ChoiceRowProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
    >
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${groupLabel}: ${labelFor(option)}`}
            onPress={() => onSelect(option)}
            style={({ pressed }) => ({
              flexGrow: 1,
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radii.md,
              borderWidth: theme.hairline.width,
              borderColor: isSelected ? theme.colors.accent : theme.colors.border,
              backgroundColor: isSelected
                ? theme.colors.accentSurface
                : pressed
                  ? theme.colors.surfacePressed
                  : theme.colors.surface,
            })}
          >
            <Text
              variant="labelSm"
              color={isSelected ? 'accent' : 'textSecondary'}
              numberOfLines={1}
            >
              {labelFor(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
          onPress={() => router.push('/baseline')}
          testID="experience-continue"
        />
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <StepIndicator step={2} total={3} />
        <Text variant="title" accessibilityRole="header">
          Your training background
        </Text>
        <Text variant="body" color="textSecondary">
          Answer honestly. This decides where your programme starts, not how capable you
          are.
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
          labelFor={(days) => `${days} DAYS`}
          onSelect={setTrainingDays}
        />
      </View>
    </Screen>
  );
}
