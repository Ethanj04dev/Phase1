import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTestCenter } from '@/features/attempt/useTestCenter';
import { useVerifiedSession } from '@/features/verification/useVerifiedSession';
import { useTheme } from '@/theme';

/**
 * Preflight for a verified assessment: what it is, what gets recorded, and
 * explicit consent — before any session exists. An interrupted session found
 * on the server is offered for resume or abandonment; it is never silently
 * discarded, and never silently continued.
 */
export default function VerifyEntryScreen() {
  const theme = useTheme();
  const { status: authStatus } = useAuth();
  const { state: center, reload } = useTestCenter();
  const { state: sessionState, begin, abandon } = useVerifiedSession();
  const [consented, setConsented] = useState(false);

  if (authStatus !== 'signed_in') {
    return (
      <Screen testID="verify-entry" contentContainerStyle={{ paddingTop: theme.spacing.lg }}>
        <Card style={{ gap: theme.spacing.lg }}>
          <Text variant="headline">Verified assessments need an account</Text>
          <Text variant="bodySm" color="textSecondary">
            Verification is a claim other candidates can trust, so it lives on the server:
            session codes, clocks and evidence checks all happen there. Sign in to start one.
          </Text>
          <Button label="Sign in" onPress={() => router.push('/auth/sign-in')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      testID="verify-entry"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={center} onRetry={reload}>
        {({ definition }) => {
          if (!definition) {
            return (
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="headline">No assessment defined yet</Text>
                <Text variant="bodySm" color="textSecondary">
                  Your pipeline does not have a modelled assessment protocol yet, so there is
                  nothing to verify.
                </Text>
              </Card>
            );
          }

          // A live session on the server takes precedence over starting fresh.
          if (
            sessionState.session &&
            (sessionState.phase === 'identity' ||
              sessionState.phase === 'between_events' ||
              sessionState.phase === 'event_open' ||
              sessionState.phase === 'ready_to_submit')
          ) {
            return (
              <Card style={{ gap: theme.spacing.lg }}>
                <Text variant="headline">A session is already in progress</Text>
                <Text variant="bodySm" color="textSecondary">
                  {`Session ${sessionState.session.challengeCode} is still open. You can continue where the server says you left off, or abandon it.`}
                </Text>
                {sessionState.error ? (
                  <Text variant="caption" color="statusOffTarget">
                    {sessionState.error}
                  </Text>
                ) : null}
                <Button
                  label="Continue session"
                  onPress={() => router.push('/verify/session')}
                  testID="resume-session"
                />
                <Button
                  label="Abandon session"
                  variant="destructive"
                  loading={sessionState.busy}
                  onPress={() => void abandon()}
                  testID="abandon-session"
                />
              </Card>
            );
          }

          return (
            <>
              <View style={{ gap: theme.spacing.xxs }}>
                <Text variant="labelSm" color="accent">
                  {definition.shortName}
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {`Verified ${definition.name}`}
                </Text>
              </View>

              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="labelSm" color="textTertiary">
                  HOW IT WORKS
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  {`You perform the complete ${definition.shortName} as one continuous session — ${definition.events.length} events, in order, with the app recording each one. A session code is issued when you start; you say it out loud at the beginning of every recording.`}
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  The order of events and the rest between them run on the server&rsquo;s
                  clock. Long gaps are recorded and reviewed. Recordings are fingerprinted
                  the moment they stop.
                </Text>
              </Card>

              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="labelSm" color="textTertiary">
                  WHAT IS RECORDED, AND WHO SEES IT
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  Video of each event, with audio. It is used only to verify this assessment,
                  stored privately, and visible to you and authorized reviewers — never on
                  your profile, never to other candidates. It is kept while this result is
                  competitive and removable afterwards.
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  Your result starts as pending review. If the evidence cannot be reliably
                  evaluated, the outcome is &ldquo;unable to verify&rdquo; — you can retest
                  any time, and nothing bad happens to your account.
                </Text>
              </Card>

              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="labelSm" color="textTertiary">
                  BEFORE YOU START
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  · A propped or tripod-mounted phone position where your whole body stays in
                  frame{'\n'}· Enough free storage for video, and a charged battery{'\n'}· The
                  full assessment in one continuous block — leave the app open throughout
                </Text>
              </Card>

              {sessionState.error ? (
                <Text variant="caption" color="statusOffTarget">
                  {sessionState.error}
                </Text>
              ) : null}

              <Button
                label={consented ? 'Start verified session' : 'I understand — record my assessment'}
                size="lg"
                loading={sessionState.busy}
                onPress={async () => {
                  if (!consented) {
                    setConsented(true);
                    return;
                  }
                  const started = await begin(definition);
                  if (started) {
                    router.push('/verify/session');
                  }
                }}
                testID="start-verified"
              />
              {consented ? (
                <Text variant="caption" color="textTertiary">
                  Starting issues your session code and opens the identity step.
                </Text>
              ) : null}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
