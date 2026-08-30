import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { RATING_LABEL } from '@/config/branding';
import type { CandidateProfile } from '@/domain/candidate/types';
import { findState } from '@/domain/candidate/states';
import { getGoalOrDefault } from '@/domain/goals/catalog';
import { useCandidateProfile } from '@/features/candidate/useCandidateProfile';
import { formatMonthYear } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * The candidate's competitive résumé.
 *
 * The hierarchy is deliberate: who you are, how good you are, whether the
 * numbers can be trusted, what you have done, what you have earned. Nothing
 * here fakes a value — a candidate with no verified performances sees em
 * dashes and honest words, not placeholder numbers, because the first real
 * number has to mean something.
 *
 * Configuration lives behind the gear. A national rank and a training-days
 * picker do not belong on the same screen.
 */

/** A labelled em-dash placeholder row: the honest empty state for a stat. */
function StatRow({ label, note }: { label: string; note?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        minHeight: theme.minTouchTarget,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Text variant="bodySm" color="textSecondary">
        {label}
      </Text>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text variant="headline" color="textTertiary">
          —
        </Text>
        {note ? (
          <Text variant="caption" color="textTertiary">
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text variant="bodySm" color="textTertiary" style={{ marginBottom: theme.spacing.md }}>
      {children}
    </Text>
  );
}

function CandidateResume({ candidate }: { candidate: CandidateProfile }) {
  const theme = useTheme();
  const goal = getGoalOrDefault(candidate.pipelineId);
  const state = candidate.stateCode ? findState(candidate.stateCode) : undefined;

  return (
    <>
      {/* WHO YOU ARE */}
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display" accessibilityRole="header">
          {`@${candidate.displayHandle}`}
        </Text>
        {candidate.displayName ? (
          <Text variant="body" color="textSecondary">
            {candidate.displayName}
          </Text>
        ) : null}
        <Text variant="labelSm" color="accent">
          {`${goal.name.toUpperCase()} CANDIDATE`}
        </Text>
        <Text variant="bodySm" color="textTertiary">
          {[
            state?.name,
            `Candidate since ${formatMonthYear(new Date(candidate.createdAt))}`,
            candidate.visibility === 'private' ? 'Private profile' : null,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>
        {candidate.bio ? (
          <Text variant="bodySm" color="textSecondary" style={{ marginTop: theme.spacing.xs }}>
            {candidate.bio}
          </Text>
        ) : null}
      </View>

      {/* HOW GOOD YOU ARE */}
      <View>
        <SectionLabel>{RATING_LABEL.toUpperCase()}</SectionLabel>
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="display" color="textTertiary">
            —
          </Text>
          <Text variant="bodySm" color="textSecondary">
            Earned through verified assessment results. The assessment system is the next
            thing being built.
          </Text>
        </Card>
      </View>

      <View>
        <SectionLabel>RANKINGS</SectionLabel>
        <Card padded={false}>
          <StatRow label="National" note="Unranked" />
          <Divider />
          <StatRow label={state ? state.name : 'State'} note={state ? 'Unranked' : 'No state declared'} />
        </Card>
      </View>

      {/* WHETHER THE NUMBERS CAN BE TRUSTED */}
      <View>
        <SectionLabel>VERIFICATION</SectionLabel>
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="headline">Not yet verified</Text>
          <Text variant="bodySm" color="textSecondary">
            Results you submit start as self-reported. Only results that pass verification
            can hold a rating or appear on a leaderboard.
          </Text>
        </Card>
      </View>

      {/* WHAT YOU HAVE DONE */}
      <View>
        <SectionLabel>VERIFIED RESULTS</SectionLabel>
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="headline" color="textTertiary">
            —
          </Text>
          <Text variant="bodySm" color="textSecondary">
            No verified results yet.
          </Text>
        </Card>
      </View>

      {/* WHAT YOU HAVE EARNED */}
      <View>
        <SectionLabel>ACHIEVEMENTS</SectionLabel>
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="headline" color="textTertiary">
            —
          </Text>
          <Text variant="bodySm" color="textSecondary">
            Nothing earned yet. Achievements come from verified performances, not from
            logging in.
          </Text>
        </Card>
      </View>
    </>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { state, reload } = useCandidateProfile();

  // Identity edits happen on screens pushed over this one.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="title" accessibilityRole="header">
          Profile
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityHint="Training configuration, account and data"
          onPress={() => router.push('/settings')}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => ({
            minWidth: theme.minTouchTarget,
            minHeight: theme.minTouchTarget,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
          testID="open-settings"
        >
          <Feather name="settings" size={20} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <AsyncBoundary state={state} onRetry={reload}>
        {(candidate) =>
          candidate ? (
            <CandidateResume candidate={candidate} />
          ) : (
            // A real state, not an error: training data can exist before a
            // candidate identity does (pre-M1 onboarding, or a migration that
            // hit a handle conflict). The fix is a claim, so offer the claim.
            <Card style={{ gap: theme.spacing.lg }}>
              <Text variant="headline">No candidate identity yet</Text>
              <Text variant="bodySm" color="textSecondary">
                Claim a handle to set up your profile. Your real name is never required.
              </Text>
              <Button
                label="Claim your handle"
                onPress={() => router.push('/settings/identity')}
                testID="claim-handle"
              />
            </Card>
          )
        }
      </AsyncBoundary>
    </Screen>
  );
}
