import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { GridBackdrop } from '@/components/layout/GridBackdrop';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { branding } from '@/config/branding';
import { getSupabaseClient } from '@/data/supabase/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { migrateLocalData } from '@/features/auth/migrateLocalData';
import { useTheme } from '@/theme';

type Mode = 'sign_in' | 'sign_up';

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);

    const failure =
      mode === 'sign_in' ? await signIn(email, password) : await signUp(email, password);
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }

    // Anything created before signing in belongs to this athlete. Moving it
    // now means an account never starts emptier than the device it was made on.
    const client = getSupabaseClient();
    if (client) {
      const outcome = await migrateLocalData(client);
      if (outcome.error) {
        setNotice(outcome.error);
      } else if (outcome.migrated) {
        setNotice('Your existing training data has been added to this account.');
      }
    }

    setBusy(false);
    router.replace('/');
  };

  return (
    <Screen
      avoidKeyboard
      scroll
      testID="sign-in"
      contentContainerStyle={{
        paddingTop: theme.spacing.xxl,
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
          {notice ? (
            <Text variant="caption" color="textSecondary">
              {notice}
            </Text>
          ) : null}
          <Button
            label={mode === 'sign_in' ? 'Sign In' : 'Create Account'}
            size="lg"
            disabled={!canSubmit}
            loading={busy}
            onPress={handleSubmit}
            testID="auth-submit"
          />
          <Button
            label={
              mode === 'sign_in' ? 'Create an account instead' : 'I already have an account'
            }
            variant="ghost"
            onPress={() => {
              setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in');
              setError(null);
              setNotice(null);
            }}
          />
        </View>
      }
    >
      <GridBackdrop divisions={10} opacity={0.25} />

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="metricLg" accessibilityRole="header">
          {branding.wordmark.lead}{' '}
          <Text variant="metricLg" color="accent">
            {branding.wordmark.numeral}
          </Text>
        </Text>
        <Text variant="body" color="textSecondary">
          {mode === 'sign_in'
            ? 'Sign in to sync your training across devices.'
            : 'Create an account to keep your training safe if you change phones.'}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.xl }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          returnKeyType="next"
          testID="auth-email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={canSubmit ? handleSubmit : undefined}
          testID="auth-password"
        />
      </View>
    </Screen>
  );
}
