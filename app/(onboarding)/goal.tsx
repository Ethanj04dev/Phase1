import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StepIndicator } from '@/components/layout/StepIndicator';
import { Button } from '@/components/primitives/Button';
import { OptionCard } from '@/components/primitives/OptionCard';
import { Text } from '@/components/primitives/Text';
import { GOALS } from '@/domain/goals/catalog';
import { SERVICE_BRANCH_LABELS, type ServiceBranch } from '@/domain/goals/types';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { useTheme } from '@/theme';

/** Branch order puts the broadest option last, where it reads as a fallback. */
const BRANCH_ORDER: readonly ServiceBranch[] = [
  'air_force',
  'navy',
  'army',
  'marine_corps',
  'general',
];

export default function GoalScreen() {
  const theme = useTheme();
  const { draft, setGoal, canAdvance } = useOnboarding();

  return (
    <Screen
      scroll
      testID="onboarding-goal"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <Button
          label="Continue"
          size="lg"
          disabled={!canAdvance('goal')}
          accessibilityHint={
            canAdvance('goal') ? undefined : 'Select what you are preparing for first'
          }
          onPress={() => router.push('/experience')}
          testID="goal-continue"
        />
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <StepIndicator step={1} total={3} />
        <Text variant="title" accessibilityRole="header">
          What are you preparing for?
        </Text>
        <Text variant="body" color="textSecondary">
          This sets how each category is weighted in your readiness score. You can change it
          later.
        </Text>
      </View>

      {BRANCH_ORDER.map((branch) => {
        const goals = GOALS.filter((goal) => goal.branch === branch);
        if (goals.length === 0) {
          return null;
        }
        return (
          <View key={branch}>
            <SectionHeader title={SERVICE_BRANCH_LABELS[branch]} />
            <View style={{ gap: theme.spacing.sm }}>
              {goals.map((goal) => (
                <OptionCard
                  key={goal.id}
                  title={goal.name}
                  subtitle={goal.description}
                  selected={draft.goalId === goal.id}
                  onPress={() => setGoal(goal.id)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
