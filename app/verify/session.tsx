import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { findAssessmentEvent } from '@/domain/assessment/types';
import { AssessmentField } from '@/features/assessment/AssessmentField';
import { EvidenceCamera } from '@/features/verification/EvidenceCamera';
import { useVerifiedSession } from '@/features/verification/useVerifiedSession';
import { formatDuration } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * The live session driver. The server owns the state machine; this screen
 * renders whatever phase the server says the session is in, which is also
 * what makes recovery free: relaunching the app lands back on this screen in
 * exactly the phase the server remembers.
 */
export default function VerifiedSessionScreen() {
  const theme = useTheme();
  const { state, captureClip, openEvent, closeEvent, submit, abandon } = useVerifiedSession();
  const [eventCaptured, setEventCaptured] = useState(false);
  const [claimValue, setClaimValue] = useState<number | undefined>(undefined);

  const { session, phase, claims, nextEvent, busy, error } = state;

  const abandonRow = (
    <Button
      label="Abandon session"
      variant="ghost"
      onPress={async () => {
        await abandon();
        router.replace('/test');
      }}
      testID="abandon-in-session"
    />
  );

  const errorRow = error ? (
    <Text variant="caption" color="statusOffTarget">
      {error}
    </Text>
  ) : null;

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="verify-session"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      {phase === 'loading' ? (
        <Text variant="bodySm" color="textTertiary">
          Checking your session with the server…
        </Text>
      ) : null}

      {phase === 'none' ? (
        <Card style={{ gap: theme.spacing.lg }}>
          <Text variant="headline">No active session</Text>
          <Text variant="bodySm" color="textSecondary">
            This session has ended or expired. Start a fresh one from the verified
            assessment screen.
          </Text>
          <Button label="Back to Test" onPress={() => router.replace('/test')} />
        </Card>
      ) : null}

      {session && phase !== 'none' && phase !== 'loading' ? (
        <Card style={{ gap: theme.spacing.xxs }}>
          <Text variant="labelSm" color="textTertiary">
            SESSION CODE
          </Text>
          <Text variant="display" color="accent">
            {session.challengeCode}
          </Text>
          <Text variant="caption" color="textTertiary">
            {`Say this code out loud at the start of every recording. ${claims.length} of ${session.eventOrder.length} events done.`}
          </Text>
        </Card>
      ) : null}

      {phase === 'identity' && session ? (
        <>
          <View style={{ gap: theme.spacing.xxs }}>
            <Text variant="headline">Identity clip</Text>
            <Text variant="bodySm" color="textSecondary">
              A short clip of your face, saying the session code. About ten seconds. This is
              what every event recording is compared against.
            </Text>
          </View>
          <EvidenceCamera
            challengeCode={session.challengeCode}
            contextLabel="Identity — say the code, face visible"
            disabled={busy}
            onCaptured={(uri, seconds) => void captureClip(null, uri, seconds)}
          />
          {errorRow}
          {abandonRow}
        </>
      ) : null}

      {phase === 'between_events' && session && nextEvent ? (
        (() => {
          const event = findAssessmentEvent(nextEvent);
          const position = session.eventOrder.indexOf(nextEvent) + 1;
          return (
            <>
              <View style={{ gap: theme.spacing.xxs }}>
                <Text variant="labelSm" color="textTertiary">
                  {`EVENT ${position} OF ${session.eventOrder.length}`}
                </Text>
                <Text variant="headline">{event?.name ?? nextEvent}</Text>
                {event ? (
                  <Text variant="bodySm" color="textSecondary">
                    {event.protocol}
                  </Text>
                ) : null}
              </View>
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="bodySm" color="textSecondary">
                  Set the phone so your whole body stays in frame, then open the event. The
                  clock starts when you open it — open, say the code, and go.
                </Text>
              </Card>
              {errorRow}
              <Button
                label={`Open ${event?.shortName ?? nextEvent}`}
                size="lg"
                loading={busy}
                onPress={async () => {
                  setEventCaptured(false);
                  setClaimValue(undefined);
                  await openEvent(nextEvent);
                }}
                testID="open-event"
              />
              {abandonRow}
            </>
          );
        })()
      ) : null}

      {phase === 'event_open' && session && session.openEvent ? (
        (() => {
          const event = findAssessmentEvent(session.openEvent);
          const position = session.eventOrder.indexOf(session.openEvent) + 1;
          if (!event) {
            return null;
          }
          return (
            <>
              <View style={{ gap: theme.spacing.xxs }}>
                <Text variant="labelSm" color="textTertiary">
                  {`EVENT ${position} OF ${session.eventOrder.length} — OPEN`}
                </Text>
                <Text variant="headline">{event.name}</Text>
              </View>

              {!eventCaptured ? (
                <EvidenceCamera
                  challengeCode={session.challengeCode}
                  contextLabel={`Event ${position} of ${session.eventOrder.length} — ${event.name}`}
                  disabled={busy}
                  onCaptured={async (uri, seconds) => {
                    const committed = await captureClip(session.openEvent, uri, seconds);
                    if (committed) {
                      setEventCaptured(true);
                    }
                  }}
                />
              ) : (
                <>
                  <Card style={{ gap: theme.spacing.sm }}>
                    <Text variant="bodySm" color="statusOnTarget">
                      Recording captured and fingerprinted.
                    </Text>
                    <Text variant="bodySm" color="textSecondary">
                      Enter the result exactly as performed. Reviewers compare it against the
                      recording.
                    </Text>
                  </Card>
                  <AssessmentField
                    event={event}
                    value={claimValue}
                    onChange={(value) => setClaimValue(value ?? undefined)}
                  />
                  <Button
                    label="Close event"
                    size="lg"
                    disabled={claimValue === undefined}
                    loading={busy}
                    onPress={async () => {
                      if (claimValue === undefined || !session.openEvent) {
                        return;
                      }
                      const closed = await closeEvent(session.openEvent, claimValue);
                      if (closed) {
                        setEventCaptured(false);
                        setClaimValue(undefined);
                      }
                    }}
                    testID="close-event"
                  />
                </>
              )}
              {errorRow}
              {abandonRow}
            </>
          );
        })()
      ) : null}

      {phase === 'ready_to_submit' && session ? (
        <>
          <View style={{ gap: theme.spacing.xxs }}>
            <Text variant="headline">Every event is closed</Text>
            <Text variant="bodySm" color="textSecondary">
              Submitting sends the assessment for verification. Results cannot change after
              this.
            </Text>
          </View>
          <Card padded={false}>
            {claims.map((claim, index) => {
              const event = findAssessmentEvent(claim.eventId);
              return (
                <View key={claim.eventId}>
                  {index > 0 ? <Divider /> : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      minHeight: theme.minTouchTarget,
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.lg,
                    }}
                  >
                    <Text variant="bodySm" color="textSecondary">
                      {event?.name ?? claim.eventId}
                    </Text>
                    <Text variant="metricMd">
                      {event?.unit === 'seconds'
                        ? formatDuration(claim.claimedValue)
                        : `${claim.claimedValue}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
          {errorRow}
          <Button
            label="Submit for verification"
            size="lg"
            loading={busy}
            onPress={() => void submit()}
            testID="submit-session"
          />
          {abandonRow}
        </>
      ) : null}

      {phase === 'submitted' ? (
        <Card style={{ gap: theme.spacing.lg }}>
          <Text variant="headline">Submitted for verification</Text>
          <Text variant="bodySm" color="textSecondary">
            Your assessment is pending review. You will see the outcome — verified, or the
            reason it could not be — in your assessment history.
          </Text>
          <Button
            label="Done"
            onPress={() => router.replace('/test')}
            testID="session-done"
          />
        </Card>
      ) : null}
    </Screen>
  );
}
