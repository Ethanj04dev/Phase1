import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { ChoiceRow } from '@/components/primitives/ChoiceRow';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { findAssessmentDefinition } from '@/data/content/assessments';
import type { ReviewDetail, ReviewEventState } from '@/data/repositories/types';
import { findAssessmentEvent } from '@/domain/assessment/types';
import {
  integrityReasonLabel,
  VERDICT_LABELS,
  type VerificationVerdict,
} from '@/domain/verification/types';
import { useReviewActions, useReviewDetail } from '@/features/verification/useReviewConsole';
import { parseDurationInput, parseRepsInput, toDurationInput } from '@/lib/parse';
import { formatDuration } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * One attempt under ground-truth review.
 *
 * The reviewer judges events; the verdict is composed by the server. Claims
 * are never edited — an adjusted count lives beside the claim with a reason,
 * and the candidate sees both.
 */

const REASON_OPTIONS = [
  'invalid_reps',
  'left_frame',
  'unjudgeable_footage',
  'protocol_violation',
  'other',
] as const;

const REASON_LABELS: Record<(typeof REASON_OPTIONS)[number], string> = {
  invalid_reps: 'Invalid reps',
  left_frame: 'Left frame',
  unjudgeable_footage: 'Unjudgeable',
  protocol_violation: 'Protocol',
  other: 'Other',
};

function EvidencePlayer({ url }: { url: string }) {
  const theme = useTheme();
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.backgroundSunken,
      }}
      allowsFullscreen
      nativeControls
    />
  );
}

function EventReviewCard({
  detail,
  event,
  onSaved,
}: {
  detail: ReviewDetail;
  event: ReviewEventState;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const { reviewEvent, openEvidence, busy, error } = useReviewActions(detail.attemptId);
  const catalogEvent = findAssessmentEvent(event.eventId);
  const isTime = catalogEvent?.unit === 'seconds';

  const [acceptedText, setAcceptedText] = useState(
    isTime ? toDurationInput(event.claimedValue) : `${event.claimedValue}`,
  );
  const [reason, setReason] = useState<(typeof REASON_OPTIONS)[number] | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const integrity = detail.integrity.find((finding) => finding.eventId === event.eventId);
  const integrityFailed = integrity?.verdict === 'failed';
  const evidence = detail.evidence.filter((item) => item.eventId === event.eventId);

  const acceptedValue = isTime ? parseDurationInput(acceptedText) : parseRepsInput(acceptedText);
  const adjusted = acceptedValue !== null && acceptedValue !== event.claimedValue;
  const needsReason = adjusted && reason === null;

  const save = async (verdict: VerificationVerdict) => {
    const saved = await reviewEvent(
      event.eventId,
      verdict,
      verdict === 'verified' ? acceptedValue : null,
      verdict === 'verified' ? (adjusted ? reason : null) : (reason ?? 'other'),
      reasonText.trim() === '' ? null : reasonText.trim(),
    );
    if (saved) {
      onSaved();
    }
  };

  return (
    <Card style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="headline">{catalogEvent?.name ?? event.eventId}</Text>
        <Text variant="bodySm" color="textSecondary">
          {`Claimed: ${isTime ? formatDuration(event.claimedValue) : event.claimedValue}`}
        </Text>
        {event.reviewVerdict ? (
          <Text variant="caption" color="accent">
            {`Reviewed — ${VERDICT_LABELS[event.reviewVerdict]}${
              event.acceptedValue !== null
                ? ` · accepted ${isTime ? formatDuration(event.acceptedValue) : event.acceptedValue}`
                : ''
            }`}
          </Text>
        ) : null}
      </View>

      {integrity && integrity.reasonCodes.length > 0 ? (
        <Card style={{ gap: theme.spacing.xxs, backgroundColor: theme.colors.backgroundSunken }}>
          <Text variant="labelSm" color="statusOffTarget">
            INTEGRITY: FAILED
          </Text>
          {integrity.reasonCodes.map((code) => (
            <Text key={code} variant="caption" color="textSecondary">
              {integrityReasonLabel(code)}
            </Text>
          ))}
          <Text variant="caption" color="textTertiary">
            Integrity is authoritative: this event will compose as failed regardless of the
            performance verdict below.
          </Text>
        </Card>
      ) : null}

      {evidence.map((item) =>
        item.storagePath ? (
          <View key={item.id} style={{ gap: theme.spacing.sm }}>
            {evidenceUrl ? <EvidencePlayer url={evidenceUrl} /> : null}
            <Button
              label={evidenceUrl ? 'Reload evidence' : 'Load evidence'}
              variant="secondary"
              onPress={async () => {
                setEvidenceError(null);
                const url = await openEvidence(item.storagePath as string);
                if (url.ok) {
                  setEvidenceUrl(url.value);
                } else {
                  setEvidenceError(url.error.message);
                }
              }}
            />
            {evidenceError ? (
              <Text variant="caption" color="statusOffTarget">
                {evidenceError}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text key={item.id} variant="caption" color="statusOffTarget">
            Evidence was committed but never finished uploading.
          </Text>
        ),
      )}

      {!integrityFailed ? (
        <>
          <TextField
            label={`Accepted ${isTime ? 'time' : 'count'}`}
            value={acceptedText}
            onChangeText={setAcceptedText}
            keyboardType="numbers-and-punctuation"
            helper={
              adjusted
                ? 'Differs from the claim — pick a reason below.'
                : 'Prefilled with the claim. Change it to adjust.'
            }
            testID={`accepted-${event.eventId}`}
          />
          <ChoiceRow
            groupLabel="Reason"
            options={REASON_OPTIONS}
            selected={reason}
            onSelect={(value) => setReason(reason === value ? null : value)}
            labelFor={(value) => REASON_LABELS[value]}
          />
          <TextField
            label="Reason detail (optional)"
            value={reasonText}
            onChangeText={setReasonText}
            placeholder="e.g. rep 12 chin below bar"
            testID={`reason-${event.eventId}`}
          />
          {error ? (
            <Text variant="caption" color="statusOffTarget">
              {error}
            </Text>
          ) : null}
          <Button
            label={adjusted ? 'Verify with adjusted value' : 'Verify as claimed'}
            loading={busy}
            disabled={acceptedValue === null || needsReason}
            onPress={() => void save('verified')}
            testID={`verify-${event.eventId}`}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Fail"
                variant="destructive"
                loading={busy}
                disabled={reason === null}
                onPress={() => void save('failed')}
                testID={`fail-${event.eventId}`}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Unable to verify"
                variant="secondary"
                loading={busy}
                disabled={reason === null}
                onPress={() => void save('unable_to_verify')}
                testID={`utv-${event.eventId}`}
              />
            </View>
          </View>
          <Text variant="caption" color="textTertiary">
            Fail needs positive evidence of invalidity. Ambiguous or unjudgeable footage is
            &ldquo;unable to verify&rdquo; — the candidate retests, nothing worse.
          </Text>
        </>
      ) : null}
    </Card>
  );
}

export default function ReviewAttemptScreen() {
  const theme = useTheme();
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { state, reload } = useReviewDetail(attemptId ?? '');
  const { finalize, busy, error } = useReviewActions(attemptId ?? '');
  const [outcome, setOutcome] = useState<string | null>(null);

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="review-attempt"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(detail) => {
          const definition = findAssessmentDefinition(
            detail.definitionId,
            detail.definitionVersion,
          );
          const allReviewed = detail.events.every(
            (event) =>
              event.reviewVerdict !== null ||
              detail.integrity.some(
                (finding) => finding.eventId === event.eventId && finding.verdict === 'failed',
              ),
          );
          const identityIntegrity = detail.integrity.find(
            (finding) => finding.eventId === null,
          );

          return (
            <>
              <View style={{ gap: theme.spacing.xxs }}>
                <Text variant="labelSm" color="accent">
                  {definition?.shortName ?? detail.definitionId}
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {definition?.name ?? 'Assessment'}
                </Text>
                <Text variant="bodySm" color="textTertiary">
                  {`Protocol v${detail.definitionVersion} · ${detail.verificationStatus}`}
                </Text>
                {detail.session ? (
                  <Text variant="caption" color="textTertiary">
                    {`Session ${detail.session.challengeCode} — the spoken code in every clip must match.`}
                  </Text>
                ) : null}
              </View>

              {identityIntegrity ? (
                <Card style={{ gap: theme.spacing.xxs }}>
                  <Text variant="labelSm" color="textTertiary">
                    IDENTITY CLIP
                  </Text>
                  <Text
                    variant="bodySm"
                    color={
                      identityIntegrity.verdict === 'verified'
                        ? 'statusOnTarget'
                        : 'statusOffTarget'
                    }
                  >
                    {identityIntegrity.verdict === 'verified'
                      ? 'Present and uploaded.'
                      : identityIntegrity.reasonCodes.map(integrityReasonLabel).join(' ')}
                  </Text>
                </Card>
              ) : null}

              {/* Server-clocked timeline, gaps visible. */}
              <Card style={{ gap: theme.spacing.xxs }} padded>
                <Text variant="labelSm" color="textTertiary">
                  SESSION TIMELINE
                </Text>
                {detail.claims.map((claim) => (
                  <Text key={claim.eventId} variant="caption" color="textSecondary">
                    {`${claim.eventId} — open ${new Date(claim.openedAt).toLocaleTimeString()} · closed ${new Date(claim.closedAt).toLocaleTimeString()}`}
                  </Text>
                ))}
              </Card>

              {detail.events.map((event, index) => (
                <View key={event.eventId} style={{ gap: theme.spacing.xl }}>
                  {index > 0 ? <Divider /> : null}
                  <EventReviewCard detail={detail} event={event} onSaved={reload} />
                </View>
              ))}

              {detail.verificationStatus === 'pending_review' ? (
                <>
                  {error ? (
                    <Text variant="caption" color="statusOffTarget">
                      {error}
                    </Text>
                  ) : null}
                  {outcome ? (
                    <Text variant="bodySm" color="accent">
                      {`Finalized: ${outcome}`}
                    </Text>
                  ) : null}
                  <Button
                    label="Finalize verdict"
                    size="lg"
                    loading={busy}
                    disabled={!allReviewed}
                    onPress={async () => {
                      const result = await finalize();
                      if (result) {
                        setOutcome(result);
                        reload();
                      }
                    }}
                    testID="finalize-attempt"
                  />
                  <Text variant="caption" color="textTertiary">
                    The verdict is composed by the server: all events verified → verified;
                    any failed → rejected; ambiguity → unable to verify. The official rating
                    is computed from accepted values, never entered.
                  </Text>
                </>
              ) : null}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
