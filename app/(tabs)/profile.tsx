import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { branding } from '@/config/branding';
import { disclaimers } from '@/config/disclaimers';
import { findTrack } from '@/domain/athlete/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { SERVICE_BRANCH_LABELS } from '@/domain/goals/types';
import { EXPERIENCE_LEVEL_LABELS } from '@/domain/types';
import { useAthleteProfile } from '@/features/settings/useProfileSettings';
import { useResetData } from '@/features/settings/useResetData';
import { formatDateStamp } from '@/lib/format';
import { useTheme } from '@/theme';

interface DetailRowProps {
  label: string;
  value: string;
  onPress?: () => void;
  hint?: string;
}

function DetailRow({ label, value, onPress, hint }: DetailRowProps) {
  const theme = useTheme();

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        minHeight: theme.minTouchTarget,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Text variant="bodySm" color="textSecondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {value}
        </Text>
        {onPress ? (
          <Text variant="mono" color="accent">
            {'>'}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.transparent,
      })}
    >
      {body}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { state, reload } = useAthleteProfile();
  const { reset, resetting, error: resetError } = useResetData();
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Edits happen on screens pushed over this one.
  useFocusEffect(
    useCallback(() => {
      reload();
      setConfirmingReset(false);
    }, [reload]),
  );

  const handleReset = async () => {
    const cleared = await reset();
    if (cleared) {
      // Straight to onboarding rather than back through the boot gate. Routing
      // via the gate leaves the tab screens mounted for a frame while they
      // refetch against now-empty storage, which surfaced as an error screen
      // flashing up immediately after a successful reset.
      router.replace('/welcome');
    }
  };

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
      <Text variant="title" accessibilityRole="header">
        Profile
      </Text>

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
          if (!profile) return null;
          const goal = getGoalOrDefault(profile.goalId);
          const track = findTrack(profile.trackId);

          return (
            <>
              <View>
                <SectionHeader title="Objective" />
                <Card padded={false}>
                  <DetailRow
                    label="Preparing for"
                    value={goal.name}
                    hint="Change what you are training for"
                    onPress={() => router.push('/settings/goal')}
                  />
                  <Divider />
                  <DetailRow label="Branch" value={SERVICE_BRANCH_LABELS[goal.branch]} />
                  <Divider />
                  <DetailRow
                    label="Track"
                    value={track?.name ?? 'Not set'}
                    hint="Change your training track"
                    onPress={() => router.push('/settings/track')}
                  />
                </Card>
              </View>

              <View>
                <SectionHeader title="Training Background" />
                <Card padded={false}>
                  <DetailRow
                    label="Running"
                    value={EXPERIENCE_LEVEL_LABELS[profile.runningExperience]}
                    hint="Update your training background"
                    onPress={() => router.push('/settings/training')}
                  />
                  <Divider />
                  <DetailRow
                    label="Swimming"
                    value={EXPERIENCE_LEVEL_LABELS[profile.swimmingExperience]}
                    hint="Update your training background"
                    onPress={() => router.push('/settings/training')}
                  />
                  <Divider />
                  <DetailRow
                    label="Rucking"
                    value={EXPERIENCE_LEVEL_LABELS[profile.ruckingExperience]}
                    hint="Update your training background"
                    onPress={() => router.push('/settings/training')}
                  />
                  <Divider />
                  <DetailRow
                    label="Training days"
                    value={`${profile.trainingDaysPerWeek} per week`}
                    hint="Update your training background"
                    onPress={() => router.push('/settings/training')}
                  />
                </Card>
              </View>

              <View>
                <SectionHeader title="Programme" />
                <Card padded={false}>
                  <DetailRow
                    label="Started"
                    value={formatDateStamp(new Date(profile.createdAt))}
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

      {/*
        Destructive and unrecoverable, so it takes two deliberate taps rather
        than a native alert, which react-native-web does not render reliably
        and which is easy to dismiss by reflex.
      */}
      <View>
        <SectionHeader title="Data" />
        <Card style={{ gap: theme.spacing.lg }}>
          {confirmingReset ? (
            <>
              <Text variant="bodySm" color="statusOffTarget">
                This permanently deletes your profile, assessments, readiness history and
                logged workouts on this device. It cannot be undone.
              </Text>
              {resetError ? (
                <Text variant="caption" color="statusOffTarget">
                  {resetError}
                </Text>
              ) : null}
              <Button
                label="Delete Everything"
                variant="destructive"
                loading={resetting}
                onPress={handleReset}
                testID="confirm-reset"
              />
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => setConfirmingReset(false)}
              />
            </>
          ) : (
            <>
              <Text variant="bodySm" color="textSecondary">
                Everything is stored on this device. Deleting it starts you over from
                onboarding.
              </Text>
              <Button
                label="Reset All Data"
                variant="secondary"
                onPress={() => setConfirmingReset(true)}
                testID="reset-data"
              />
            </>
          )}
        </Card>
      </View>

      <Text variant="monoSm" color="textTertiary" align="center">
        {`${branding.productName}  //  v1.0.0`}
      </Text>
    </Screen>
  );
}
