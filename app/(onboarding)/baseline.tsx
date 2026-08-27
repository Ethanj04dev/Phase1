import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StepIndicator } from '@/components/layout/StepIndicator';
import { Button } from '@/components/primitives/Button';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { ASSESSMENT_EVENTS } from '@/domain/assessment/types';
import { PERFORMANCE_CATEGORY_LABELS, type PerformanceCategory } from '@/domain/types';
import { AssessmentField } from '@/features/assessment/AssessmentField';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

/** Category order for the form; matches the readiness breakdown. */
const CATEGORY_ORDER: readonly PerformanceCategory[] = [
  'calisthenics',
  'running',
  'swimming',
  'rucking',
];

export default function BaselineScreen() {
  const theme = useTheme();
  const { draft, setBaselineValue, outcome } = useOnboarding();

  const tested = outcome.testedEventCount;
  const total = ASSESSMENT_EVENTS.length;

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="onboarding-baseline"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <Button
          label={tested === 0 ? 'Skip Baseline' : 'See Readiness'}
          size="lg"
          onPress={() => router.push('/result')}
          accessibilityHint={
            tested === 0 ? 'Continue without entering any test results' : undefined
          }
          testID="baseline-continue"
        />
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <StepIndicator step={3} total={3} />
        <Text variant="title" accessibilityRole="header">
          Where are you now?
        </Text>
        <Text variant="body" color="textSecondary">
          Enter whatever you have tested recently. Skip anything you have not — your score will
          say how complete it is, and you can fill the gaps any time.
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="labelSm" color="textTertiary">
            {`${tested} OF ${total} ENTERED`}
          </Text>
          <Text variant="labelSm" color={tested === 0 ? 'textTertiary' : 'accent'}>
            {outcome.calculation
              ? `${formatPercent(outcome.calculation.coverage)} COVERAGE`
              : 'No score yet'}
          </Text>
        </View>
      </View>

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
                    value={draft.baseline[event.id]}
                    onChange={(value) => setBaselineValue(event.id, value)}
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
