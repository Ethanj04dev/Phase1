import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { branding } from '@/config/branding';
import { disclaimers } from '@/config/disclaimers';
import { findPipeline } from '@/data/content/pipelines';
import { findTrack } from '@/domain/athlete/types';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { SERVICE_BRANCH_LABELS } from '@/domain/goals/types';
import { EXPERIENCE_LEVEL_LABELS } from '@/domain/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAthleteProfile } from '@/features/settings/useProfileSettings';
import { useResetData } from '@/features/settings/useResetData';
import { formatDateStamp } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * The settings hub: configuration, account and disclosures.
 *
 * This content lived on the Profile tab until M1. The tab now belongs to the
 * candidate's competitive identity — who they are, how good, what is
 * verified — and configuration moved here, one gear-tap away, where changing
 * a training day does not share a screen with a national rank.
 */

/** A section label. Plain text rather than a stamped header, per the design pass. */
function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text variant="bodySm" color="textTertiary" style={{ marginBottom: theme.spacing.md }}>
      {children}
    </Text>
  );
}

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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          flexShrink: 1,
        }}
      >
        <Text variant="headline" numberOfLines={1}>
          {value}
        </Text>
        {/* Same chevron as every other navigable row in the app. */}
        {onPress ? (
          <Text variant="body" color="textTertiary">
            ›
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

export default function SettingsScreen() {
  const theme = useTheme();
  const { state, reload } = useAthleteProfile();
  const { reset, resetting, error: resetError } = useResetData();
  const { status: authStatus, signOut } = useAuth();
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
      testID="settings-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <View>
        <SectionLabel>Identity</SectionLabel>
        <Card padded={false}>
          <DetailRow
            label="Handle, state and visibility"
            value="Edit"
            hint="Change your public identity"
            onPress={() => router.push('/settings/identity')}
          />
        </Card>
      </View>

      <AsyncBoundary
        state={state}
        onRetry={reload}
        isEmpty={(profile) => profile === null}
        empty={{
          title: 'No profile yet',
          body: 'Complete onboarding to set your pipeline and training track.',
        }}
      >
        {(profile) => {
          if (!profile) return null;
          const goal = getGoalOrDefault(profile.goalId);
          // Content lookup, not a fetch: the definition ships with the app.
          const pipeline = findPipeline(profile.goalId);
          const track = findTrack(profile.trackId);

          return (
            <>
              <View>
                <SectionLabel>Pipeline</SectionLabel>
                <Card padded={false}>
                  <DetailRow
                    label="Preparing for"
                    value={pipeline?.name ?? goal.name}
                    hint="Change what you are training for"
                    onPress={() => router.push('/settings/goal')}
                  />
                  <Divider />
                  <DetailRow label="Branch" value={SERVICE_BRANCH_LABELS[goal.branch]} />
                  <Divider />
                  <DetailRow
                    label="Selection date"
                    value={profile.selectionDate ?? 'Not set'}
                    hint="Set the date the countdown counts to"
                    onPress={() => router.push('/settings/selection-date')}
                  />
                  {/* Only offered where there is something to open. The other
                      careers have no pipeline screen to send anyone to. */}
                  {pipeline ? (
                    <>
                      <Divider />
                      <DetailRow
                        label="Details"
                        value="Open pipeline"
                        hint="Demands, stages, milestones and career intel"
                        onPress={() => router.push('/pipeline')}
                      />
                    </>
                  ) : null}
                </Card>
              </View>

              <View>
                <SectionLabel>Training</SectionLabel>
                <Card padded={false}>
                  <DetailRow
                    label="Track"
                    value={track?.name ?? 'Not set'}
                    hint="Change your training track"
                    onPress={() => router.push('/settings/track')}
                  />
                  <Divider />
                  <DetailRow
                    label="Days per week"
                    value={`${profile.trainingDaysPerWeek}`}
                    hint="Update your training background"
                    onPress={() => router.push('/settings/training')}
                  />
                  <Divider />
                  <DetailRow
                    label="Started"
                    value={formatDateStamp(new Date(profile.createdAt))}
                  />
                </Card>
              </View>

              <View>
                <SectionLabel>Experience</SectionLabel>
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
                </Card>
              </View>
            </>
          );
        }}
      </AsyncBoundary>

      {/* Only shown when a backend is configured. With none, there is no
          account to sign out of and the row would be a dead end. */}
      {authStatus !== 'disabled' ? (
        <View>
          <SectionLabel>Account</SectionLabel>
          <Card style={{ gap: theme.spacing.lg }}>
            <Text variant="bodySm" color="textSecondary">
              {authStatus === 'signed_in'
                ? 'Your training is synced to your account.'
                : 'Sign in to keep your training if you change phones.'}
            </Text>
            <Button
              label={authStatus === 'signed_in' ? 'Sign out' : 'Sign in'}
              variant="secondary"
              onPress={async () => {
                if (authStatus === 'signed_in') {
                  await signOut();
                }
                router.replace('/auth/sign-in');
              }}
              testID="auth-action"
            />
          </Card>
          {/* The ground-truth console. Access is enforced server-side; this
              row just avoids hiding the door from the people with the key. */}
          {authStatus === 'signed_in' ? (
            <Card padded={false} style={{ marginTop: theme.spacing.md }}>
              <DetailRow
                label="Ground-truth console"
                value="Open"
                hint="Reviewer access only"
                onPress={() => router.push('/review')}
              />
            </Card>
          ) : null}
        </View>
      ) : null}

      {/* Required disclosures. Present from the first build, not bolted on
          later, and deliberately above the destructive action rather than
          buried under it. */}
      <View>
        <SectionLabel>What this product is</SectionLabel>
        <Card style={{ gap: theme.spacing.lg }}>
          <Text variant="bodySm" color="textSecondary">
            {disclaimers.affiliation}
          </Text>
          <Text variant="bodySm" color="textSecondary">
            {disclaimers.readiness}
          </Text>
          <Text variant="bodySm" color="textSecondary">
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
        <SectionLabel>Data</SectionLabel>
        <Card style={{ gap: theme.spacing.lg }}>
          {confirmingReset ? (
            <>
              <Text variant="bodySm" color="statusOffTarget">
                This permanently deletes your profile, assessments, readiness history and logged
                workouts on this device. It cannot be undone.
              </Text>
              {resetError ? (
                <Text variant="caption" color="statusOffTarget">
                  {resetError}
                </Text>
              ) : null}
              <Button
                label="Delete everything"
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
                label="Reset all data"
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
