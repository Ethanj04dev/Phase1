import { router } from 'expo-router';
import { View } from 'react-native';

import { ReadinessGauge } from '@/components/charts/ReadinessGauge';
import { MetricTile } from '@/components/data-display/MetricTile';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { disclaimers } from '@/config/disclaimers';
import { findTrack } from '@/domain/athlete/types';
import {
  PERFORMANCE_CATEGORIES,
  PERFORMANCE_CATEGORY_LABELS,
  type PerformanceCategory,
} from '@/domain/types';
import { countdownLabel, countdownTo } from '@/domain/target/countdown';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

const CAUTION_SCORE = 65;

export default function ResultScreen() {
  const theme = useTheme();
  const { draft, outcome, submit, submitting, submitError } = useOnboarding();
  const { calculation, goal, recommendation } = outcome;
  const track = findTrack(recommendation.trackId);

  const handleBegin = async () => {
    const saved = await submit();
    if (saved) {
      // Replace, not push: onboarding must not be reachable with a back swipe
      // once the profile exists.
      router.replace('/(tabs)');
    }
  };

  return (
    <Screen
      scroll
      testID="onboarding-result"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <View style={{ gap: theme.spacing.md }}>
          {submitError ? (
            <Text variant="caption" color="statusOffTarget">
              {submitError}
            </Text>
          ) : null}
          <Button
            label="Begin Phase 1"
            size="lg"
            loading={submitting}
            onPress={handleBegin}
            testID="begin-phase-1"
          />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="labelSm" color="textTertiary">
          {goal.shortName}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {calculation ? 'Your starting point' : 'You are set up'}
        </Text>
        {(() => {
          const countdown = countdownLabel(
            countdownTo(draft.selectionDate, new Date().toISOString()),
          );
          return countdown ? (
            <Text variant="bodySm" color="accent">
              {countdown}
            </Text>
          ) : null;
        })()}
      </View>

      {calculation ? (
        // The first number this product ever shows an athlete arrives on the
        // signature instrument, open section and all. Honesty is the first
        // impression, not something discovered later.
        <Card style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
          <ReadinessGauge
            score={calculation.overall}
            coverage={calculation.coverage}
            caption="Starting point"
            accessibilityLabel={`Starting readiness ${calculation.overall} out of 100, measured on ${formatPercent(calculation.coverage)} of your profile`}
          />
          {calculation.coverage < 1 ? (
            <Text variant="caption" color="textTertiary" align="center">
              {`The open section is the ${formatPercent(1 - calculation.coverage)} of your profile you have not tested yet. It fills in as you do.`}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="textTertiary">
            No score yet
          </Text>
          <Text variant="body" color="textSecondary">
            You skipped the baseline, so there is nothing to score yet. Log an assessment
            whenever you are ready and your readiness will appear.
          </Text>
        </Card>
      )}

      {calculation ? (
        <View>
          <SectionHeader title="Breakdown" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {PERFORMANCE_CATEGORIES.map((category: PerformanceCategory) => {
              const score = calculation.categories[category];
              if (score === undefined) {
                return null;
              }
              return (
                <View key={category} style={{ flexGrow: 1, flexBasis: '46%' }}>
                  <MetricTile
                    label={PERFORMANCE_CATEGORY_LABELS[category]}
                    value={String(score)}
                    progress={score / 100}
                    tone={score < CAUTION_SCORE ? 'caution' : 'accent'}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {calculation?.strongestCategory && calculation.priorityCategory ? (
        <View>
          <SectionHeader title="Focus" />
          <Card padded={false}>
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
              <Text variant="labelSm" color="textTertiary">
                Strongest
              </Text>
              <Text variant="headline">
                {PERFORMANCE_CATEGORY_LABELS[calculation.strongestCategory]}
              </Text>
            </View>
            <View
              style={{
                padding: theme.spacing.lg,
                gap: theme.spacing.xxs,
                borderTopWidth: theme.hairline.width,
                borderTopColor: theme.colors.border,
              }}
            >
              <Text variant="labelSm" color="accent">
                Priority
              </Text>
              <Text variant="headline">
                {PERFORMANCE_CATEGORY_LABELS[calculation.priorityCategory]}
              </Text>
              <Text variant="caption" color="textTertiary">
                Where improvement moves your score the most, given your goal.
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      <View>
        <SectionHeader title="Your track" />
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="headline">{track?.name ?? 'Selection Prep'}</Text>
          <Text variant="body" color="textSecondary">
            {recommendation.rationale}
          </Text>
          <Text variant="caption" color="textTertiary">
            You can change this any time in your profile.
          </Text>
        </Card>
      </View>

      <Text variant="caption" color="textTertiary">
        {disclaimers.readiness}
      </Text>
    </Screen>
  );
}
