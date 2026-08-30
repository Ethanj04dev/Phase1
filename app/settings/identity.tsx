import { useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { ChoiceRow } from '@/components/primitives/ChoiceRow';
import { OptionCard } from '@/components/primitives/OptionCard';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { validateHandle } from '@/domain/candidate/handle';
import { findState, US_STATES } from '@/domain/candidate/states';
import { BIO_MAX_LENGTH, type CandidateProfile } from '@/domain/candidate/types';
import { useCandidateProfile } from '@/features/candidate/useCandidateProfile';
import {
  useSaveCandidateIdentity,
  type IdentityDraft,
} from '@/features/candidate/useSaveCandidateIdentity';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * Edit — or first claim — the candidate identity.
 *
 * One screen for both because they are the same act: deciding how you appear.
 * Everything except the handle is optional, and the privacy caption tells the
 * truth about what public means before the choice is made.
 */

function draftFrom(candidate: CandidateProfile | null): IdentityDraft {
  return {
    handleInput: candidate?.displayHandle ?? '',
    displayName: candidate?.displayName ?? '',
    stateCode: candidate?.stateCode ?? null,
    visibility: candidate?.visibility ?? 'public',
    bio: candidate?.bio ?? '',
  };
}

function IdentityEditor({ candidate }: { candidate: CandidateProfile | null }) {
  const theme = useTheme();
  const { save, saving, error } = useSaveCandidateIdentity();
  const [draft, setDraft] = useState<IdentityDraft>(() => draftFrom(candidate));
  const [touched, setTouched] = useState(false);

  const validation = validateHandle(draft.handleInput);
  const showHandleError = touched && draft.handleInput.trim().length > 0 && !validation.ok;

  const handleSave = async () => {
    const saved = await save(candidate, draft);
    if (saved) {
      goBack('/profile');
    }
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="settings-identity"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <View style={{ gap: theme.spacing.md }}>
          {error ? (
            <Text variant="caption" color="statusOffTarget">
              {error}
            </Text>
          ) : null}
          <Button
            label={candidate ? 'Save identity' : 'Claim handle'}
            size="lg"
            disabled={!validation.ok}
            loading={saving}
            onPress={handleSave}
            testID="save-identity"
          />
        </View>
      }
    >
      <TextField
        label="Handle"
        value={draft.handleInput}
        onChangeText={(next) => {
          setDraft((current) => ({ ...current, handleInput: next }));
          setTouched(true);
        }}
        placeholder="@your_handle"
        autoCapitalize="none"
        autoCorrect={false}
        helper={
          showHandleError
            ? undefined
            : '3–20 characters. Letters, numbers and underscores; starts with a letter.'
        }
        error={showHandleError && !validation.ok ? validation.message : undefined}
        testID="identity-handle"
      />

      <TextField
        label="Display name (optional)"
        value={draft.displayName}
        onChangeText={(next) => setDraft((current) => ({ ...current, displayName: next }))}
        placeholder="Shown under your handle"
        maxLength={50}
        helper="Your real name is never required."
        testID="identity-display-name"
      />

      <TextField
        label="Bio (optional)"
        value={draft.bio}
        onChangeText={(next) => setDraft((current) => ({ ...current, bio: next }))}
        placeholder="One or two lines"
        maxLength={BIO_MAX_LENGTH}
        multiline
        testID="identity-bio"
      />

      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="headline">Your state</Text>
          <Text variant="bodySm" color="textSecondary">
            Optional. The most precise location Zero Phase ever records.
          </Text>
        </View>
        {draft.stateCode ? (
          <Text variant="bodySm" color="accent">
            {findState(draft.stateCode)?.name ?? draft.stateCode}
          </Text>
        ) : (
          <Text variant="bodySm" color="textTertiary">
            No state declared
          </Text>
        )}
        <ChoiceRow
          groupLabel="State"
          options={US_STATES.map((state) => state.code)}
          selected={draft.stateCode}
          onSelect={(code) =>
            setDraft((current) => ({
              ...current,
              stateCode: current.stateCode === code ? null : code,
            }))
          }
          labelFor={(code) => code}
        />
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="headline">Profile visibility</Text>
        </View>
        <OptionCard
          title="Public"
          subtitle="Your handle, pipeline and verified results can appear on leaderboards and your profile can be found."
          selected={draft.visibility === 'public'}
          onPress={() => setDraft((current) => ({ ...current, visibility: 'public' }))}
        />
        <OptionCard
          title="Private"
          subtitle="Track everything for yourself. You never appear on leaderboards or in searches."
          selected={draft.visibility === 'private'}
          onPress={() => setDraft((current) => ({ ...current, visibility: 'private' }))}
        />
      </View>

      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="labelSm" color="textTertiary">
          What is never shown
        </Text>
        <Text variant="bodySm" color="textSecondary">
          Your email, exact location, and anything about a military application are never
          public, whatever you choose here.
        </Text>
      </Card>
    </Screen>
  );
}

export default function IdentitySettingsScreen() {
  const theme = useTheme();
  const { state, reload } = useCandidateProfile();

  // The editor owns its Screen (it needs the keyboard-avoiding footer), so
  // the boundary only wraps the pre-success states.
  if (state.status === 'success') {
    return <IdentityEditor candidate={state.data} />;
  }

  return (
    <Screen
      testID="settings-identity"
      contentContainerStyle={{ paddingTop: theme.spacing.lg }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {() => null}
      </AsyncBoundary>
    </Screen>
  );
}
