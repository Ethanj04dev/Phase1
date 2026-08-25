import { useCallback } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { branding } from '@/config/branding';
import { disclaimers } from '@/config/disclaimers';
import { useRepositories } from '@/data/repositoryContext';
import { findTrack } from '@/domain/athlete/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { SERVICE_BRANCH_LABELS } from '@/domain/goals/types';
import { EXPERIENCE_LEVEL_LABELS } from '@/domain/types';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { useTheme } from '@/theme';

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Text variant="bodySm" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline" style={{ flexShrink: 1 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { athlete } = useRepositories();

  const fetcher = useCallback(() => athlete.getCurrentProfile(), [athlete]);
  const { state, reload } = useAsyncResource(fetcher);

  return (
    <Screen
      scroll
      testID="profile-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <Text variant="title">Profile</Text>

      <AsyncBoundary
        state={state}
        onRetry={reload}
        isEmpty={(profile) => profile === null}
        empty={{
          title: 'No profile yet',
          body: 'Complete onboarding to set your goal and training track.',
        }}
      >
        {(profile) => {
          if (!profile) {
            return null;
          }
          const goal = getGoalOrDefault(profile.goalId);
          const track = findTrack(profile.trackId);

          return (
            <>
              <View>
                <SectionHeader title="Objective" />
                <Card padded={false}>
                  <DetailRow label="Preparing for" value={goal.name} />
                  <Divider />
                  <DetailRow label="Branch" value={SERVICE_BRANCH_LABELS[goal.branch]} />
                  <Divider />
                  <DetailRow label="Track" value={track?.name ?? 'Not set'} />
                  <Divider />
                  <DetailRow
                    label="Training days"
                    value={`${profile.trainingDaysPerWeek} per week`}
                  />
                </Card>
              </View>

              <View>
                <SectionHeader title="Experience" />
                <Card padded={false}>
                  <DetailRow
                    label="Running"
                    value={EXPERIENCE_LEVEL_LABELS[profile.runningExperience]}
                  />
                  <Divider />
                  <DetailRow
                    label="Swimming"
                    value={EXPERIENCE_LEVEL_LABELS[profile.swimmingExperience]}
                  />
                  <Divider />
                  <DetailRow
                    label="Rucking"
                    value={EXPERIENCE_LEVEL_LABELS[profile.ruckingExperience]}
                  />
                </Card>
              </View>
            </>
          );
        }}
      </AsyncBoundary>

      {/* Required disclosures. Present from the first build, not bolted on later. */}
      <View>
        <SectionHeader title="About" />
        <Card style={{ gap: theme.spacing.lg }}>
          <Text variant="caption" color="textSecondary">
            {disclaimers.affiliation}
          </Text>
          <Text variant="caption" color="textSecondary">
            {disclaimers.readiness}
          </Text>
          <Text variant="caption" color="textSecondary">
            {disclaimers.training}
          </Text>
          <Text variant="caption" color="textTertiary">
            {disclaimers.medical}
          </Text>
        </Card>
      </View>

      <Text variant="monoSm" color="textTertiary" align="center">
        {`${branding.productName}  //  v1.0.0`}
      </Text>
    </Screen>
  );
}
