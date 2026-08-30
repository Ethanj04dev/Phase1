import { useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { OptionCard } from '@/components/primitives/OptionCard';
import { hasPipelineDefinition } from '@/data/content/pipelines';
import { Text } from '@/components/primitives/Text';
import { GOALS } from '@/domain/goals/catalog';
import { SERVICE_BRANCH_LABELS, type GoalId, type ServiceBranch } from '@/domain/goals/types';
import { useRepositories } from '@/data/repositoryContext';
import { syncCandidatePipeline } from '@/features/candidate/syncCandidatePipeline';
import { useAthleteProfile, useUpdateProfile } from '@/features/settings/useProfileSettings';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

const BRANCH_ORDER: readonly ServiceBranch[] = [
  'air_force',
  'navy',
  'army',
  'marine_corps',
  'general',
];

export default function EditGoalScreen() {
  const theme = useTheme();
  const { candidate } = useRepositories();
  const { state, reload } = useAthleteProfile();
  const { update, saving, error } = useUpdateProfile();
  const [selected, setSelected] = useState<GoalId | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const current = state.status === 'success' ? (state.data?.goalId ?? null) : null;
  const chosen = selected ?? current;
  const changed = chosen !== null && chosen !== current;

  const handleSave = async () => {
    if (!chosen) return;
    setSyncError(null);
    const updated = await update({ goalId: chosen });
    if (!updated) {
      return;
    }
    // The candidate identity carries the same pipeline. One account, one
    // history: changing pipeline updates it in place rather than forking.
    const synced = await syncCandidatePipeline(candidate, chosen);
    if (!synced.ok) {
      setSyncError(synced.error.message);
      return;
    }
    goBack('/profile');
  };

  return (
    <Screen
      scroll
      testID="settings-goal"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <View style={{ gap: theme.spacing.md }}>
          {error || syncError ? (
            <Text variant="caption" color="statusOffTarget">
              {error ?? syncError}
            </Text>
          ) : null}
          <Button
            label={changed ? 'Save Objective' : 'No Changes'}
            size="lg"
            disabled={!changed}
            loading={saving}
            onPress={handleSave}
            testID="save-goal"
          />
        </View>
      }
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {() => (
          <>
            {/* Stated up front, because the score moving after a goal change
                would otherwise look like a bug. */}
            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="labelSm" color="textTertiary">
                Changing this changes your score
              </Text>
              <Text variant="bodySm" color="textSecondary">
                Each objective weights the four categories differently, so your readiness will
                be recalculated from the same results. Your training history is not affected.
              </Text>
            </Card>

            {BRANCH_ORDER.map((branch) => {
              const goals = GOALS.filter((goal) => goal.branch === branch);
              if (goals.length === 0) return null;
              return (
                <View key={branch}>
                  <SectionHeader title={SERVICE_BRANCH_LABELS[branch]} />
                  <View style={{ gap: theme.spacing.sm }}>
                    {goals.map((goal) => (
                      <OptionCard
                        key={goal.id}
                        title={goal.name}
                        subtitle={goal.description}
                        meta={
                          goal.id === current
                            ? 'Current'
                            : hasPipelineDefinition(goal.id)
                              ? 'Full target'
                              : undefined
                        }
                        selected={chosen === goal.id}
                        onPress={() => setSelected(goal.id)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
