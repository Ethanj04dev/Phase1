import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StepIndicator } from '@/components/layout/StepIndicator';
import { Button } from '@/components/primitives/Button';
import { ChoiceRow } from '@/components/primitives/ChoiceRow';
import { OptionCard } from '@/components/primitives/OptionCard';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { useRepositories } from '@/data/repositoryContext';
import { validateHandle } from '@/domain/candidate/handle';
import { findState, US_STATES } from '@/domain/candidate/states';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { useTheme } from '@/theme';

/**
 * The identity step: handle, state, visibility.
 *
 * The handle is the candidate's public name everywhere — real names are never
 * required, and nothing else on this screen is mandatory. Availability is
 * checked live but treated as advisory: the claim only becomes real when the
 * profile is written, and the write is what can still refuse it.
 */

const AVAILABILITY_DEBOUNCE_MS = 400;

type Availability = 'unknown' | 'checking' | 'available' | 'taken';

export default function IdentityScreen() {
  const theme = useTheme();
  const { candidate } = useRepositories();
  const { status: authStatus } = useAuth();
  const { draft, setHandleInput, setStateCode, setVisibility, canAdvance } = useOnboarding();

  const [touched, setTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>('unknown');

  const validation = validateHandle(draft.handleInput);
  const signedIn = authStatus === 'signed_in';
  const normalizedHandle = validation.ok ? validation.handle : null;

  // Availability is only worth asking about once the handle is well-formed,
  // and only an account can genuinely hold a handle. The check is debounced so
  // typing does not fire a request per keystroke.
  useEffect(() => {
    if (!normalizedHandle || !signedIn) {
      setAvailability('unknown');
      return;
    }
    const handle = normalizedHandle;
    setAvailability('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await candidate.isHandleAvailable(handle);
      if (cancelled) {
        return;
      }
      // A failed check reads as unknown rather than blocking the flow; the
      // create call is the enforcement point either way.
      if (!result.ok) {
        setAvailability('unknown');
        return;
      }
      setAvailability(result.value ? 'available' : 'taken');
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [candidate, normalizedHandle, signedIn]);

  const showError = touched && draft.handleInput.trim().length > 0 && !validation.ok;
  const blocked = !canAdvance('identity') || availability === 'taken';

  const availabilityLine = (() => {
    if (!validation.ok) {
      return null;
    }
    switch (availability) {
      case 'checking':
        return { color: 'textTertiary' as const, text: 'Checking availability…' };
      case 'available':
        return { color: 'statusOnTarget' as const, text: `@${validation.handle} is available` };
      case 'taken':
        return { color: 'statusOffTarget' as const, text: `@${validation.handle} is taken` };
      case 'unknown':
        return signedIn
          ? null
          : {
              color: 'textTertiary' as const,
              text: 'Saved on this device. The handle is claimed for real when you create an account.',
            };
    }
  })();

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="onboarding-identity"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <Button
          label="Continue"
          size="lg"
          disabled={blocked}
          accessibilityHint={blocked ? 'Choose an available handle first' : undefined}
          onPress={() => router.push('/experience')}
          testID="identity-continue"
        />
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <StepIndicator step={2} total={5} />
        <Text variant="title" accessibilityRole="header">
          Choose your handle
        </Text>
        <Text variant="body" color="textSecondary">
          This is your name on Zero Phase — on your profile and, if you compete publicly, on
          the leaderboards. Your real name is never required.
        </Text>
      </View>

      <TextField
        label="Handle"
        value={draft.handleInput}
        onChangeText={(next) => {
          setHandleInput(next);
          setTouched(true);
        }}
        placeholder="@your_handle"
        autoCapitalize="none"
        autoCorrect={false}
        helper={
          showError
            ? undefined
            : '3–20 characters. Letters, numbers and underscores; starts with a letter.'
        }
        error={showError && !validation.ok ? validation.message : undefined}
        testID="identity-handle-input"
      />

      {availabilityLine ? (
        <Text variant="bodySm" color={availabilityLine.color}>
          {availabilityLine.text}
        </Text>
      ) : null}

      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="headline">Your state</Text>
          <Text variant="bodySm" color="textSecondary">
            Optional. Powers state leaderboards later — it is the most precise location Zero
            Phase ever records, and you can leave it out.
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
          onSelect={(code) => setStateCode(draft.stateCode === code ? null : code)}
          labelFor={(code) => code}
        />
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="headline">Profile visibility</Text>
          <Text variant="bodySm" color="textSecondary">
            You can change this any time.
          </Text>
        </View>
        <OptionCard
          title="Public"
          subtitle="Your handle, pipeline and verified results can appear on leaderboards and your profile can be found."
          selected={draft.visibility === 'public'}
          onPress={() => setVisibility('public')}
        />
        <OptionCard
          title="Private"
          subtitle="Track everything for yourself. You never appear on leaderboards or in searches."
          selected={draft.visibility === 'private'}
          onPress={() => setVisibility('private')}
        />
      </View>
    </Screen>
  );
}
