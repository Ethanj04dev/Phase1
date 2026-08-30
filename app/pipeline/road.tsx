import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { Text } from '@/components/primitives/Text';
import { findAssessmentEvent } from '@/domain/assessment/types';
import { PHASE1_TARGET_READINESS } from '@/domain/readiness/bands';
import { countdownLabel, countdownTo } from '@/domain/pipeline/countdown';
import { preparationDomain } from '@/domain/pipeline/domains';
import type { RoadStep } from '@/domain/pipeline/roadToReady';
import { formatEventDelta, formatEventValue } from '@/features/assessment/display';
import { impactPoints, ROAD_STEP_LABELS, roadStepInstruction } from '@/features/pipeline/roadCopy';
import { usePipeline } from '@/features/pipeline/usePipeline';
import { formatPercent } from '@/lib/format';
import { useTheme, type ColorToken } from '@/theme';

/** Muted for anything that is not asking for action. */
function toneFor(step: RoadStep): ColorToken {
  return step.kind === 'improve' || step.kind === 'measure' ? 'accent' : 'textTertiary';
}

function StepEvents({ step }: { step: RoadStep }) {
  const theme = useTheme();
  if (step.events.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {step.events.map((gap) => {
        const event = findAssessmentEvent(gap.eventId);
        if (!event) {
          return null;
        }
        return (
          <View
            key={gap.eventId}
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <Text variant="bodySm" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
              {event.name}
            </Text>
            <Text variant="bodySm" color={gap.met ? 'statusOnTarget' : 'textPrimary'}>
              {/* Never tested reads as blank, not as zero. */}
              {gap.current === null ? '—' : formatEventValue(event, gap.current)}
            </Text>
            <Text variant="caption" color="textTertiary" style={{ width: 96, textAlign: 'right' }}>
              {gap.current === null
                ? 'Not tested'
                : gap.met
                  ? 'At benchmark'
                  : `${formatEventDelta(event, gap.gap ?? 0)} to go`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function RoadToReadyScreen() {
  const theme = useTheme();
  const { state, reload } = usePipeline();

  return (
    <Screen
      scroll
      testID="target-road"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ pipeline, road, readiness, profile }) => {
          if (!pipeline || !road) {
            return (
              <Text variant="body" color="textSecondary">
                A road to ready needs a fully modelled pipeline. Yours is not built yet.
              </Text>
            );
          }

          const countdown = countdownLabel(
            countdownTo(profile.selectionDate, new Date().toISOString()),
          );

          return (
            <>
              {/* The deadline the list is working against, when one exists. */}
              {countdown ? (
                <Text variant="headline" color="accent">
                  {countdown}
                </Text>
              ) : null}
              <Text variant="body" color="textSecondary">
                {`Ordered by how much readiness each area is holding, not by which is weakest. A gap in something ${pipeline.shortName} leans on heavily is worth more than a bigger gap in something it barely touches.`}
              </Text>

              {road.focus ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="bodySm" color="textTertiary">
                    Start here
                  </Text>
                  <Text variant="title">{preparationDomain(road.focus.domainId).label}</Text>
                  <Text variant="body" color="textSecondary">
                    {roadStepInstruction(road.focus)}
                  </Text>
                  {impactPoints(road.focus) > 0 ? (
                    <Text variant="caption" color="textTertiary">
                      {`Worth about ${impactPoints(road.focus)} points of overall readiness.`}
                    </Text>
                  ) : null}
                </Card>
              ) : (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="title">Everything measured is at benchmark</Text>
                  <Text variant="body" color="textSecondary">
                    Nothing here is holding your score back. Hold the work you are doing and
                    retest periodically to confirm it is still true.
                  </Text>
                </Card>
              )}

              {/* Stated where it changes how the number should be read, not
                  hidden in a footnote. */}
              {road.unmeasuredWeight > 0 ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="headline" color="statusCaution">
                    {`${formatPercent(road.unmeasuredWeight)} of this pipeline is unmeasured`}
                  </Text>
                  <Text variant="bodySm" color="textSecondary">
                    Your readiness is calculated from the rest. It is not wrong, but it is
                    describing a smaller picture than it appears to.
                  </Text>
                </Card>
              ) : null}

              <View>
                <Text
                  variant="bodySm"
                  color="textTertiary"
                  style={{ marginBottom: theme.spacing.md }}
                >
                  The full list
                </Text>
                <Card padded={false}>
                  {road.steps.map((step, index) => {
                    const info = preparationDomain(step.domainId);
                    const points = impactPoints(step);
                    return (
                      <View key={step.domainId}>
                        {index > 0 ? <Divider /> : null}
                        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: theme.spacing.md,
                            }}
                          >
                            <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
                              {info.label}
                            </Text>
                            {/* Status is carried by the words, not only by
                                the colour they are drawn in. */}
                            <Text variant="bodySm" color={toneFor(step)}>
                              {ROAD_STEP_LABELS[step.kind]}
                            </Text>
                          </View>

                          {step.score === null ? null : (
                            <ProgressBar
                              value={step.score / PHASE1_TARGET_READINESS}
                              tone={step.kind === 'maintain' ? 'onTarget' : 'accent'}
                              accessibilityLabel={`${info.label} is at ${step.score} of a ${PHASE1_TARGET_READINESS} benchmark`}
                            />
                          )}

                          <Text variant="bodySm" color="textSecondary">
                            {roadStepInstruction(step)}
                          </Text>

                          <StepEvents step={step} />

                          {points > 0 ? (
                            <Text variant="caption" color="textTertiary">
                              {`${points} readiness points available here`}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </View>

              {readiness ? (
                <Text variant="caption" color="textTertiary">
                  {`Your readiness is ${readiness.overall}. Zero Phase suggests aiming for ${PHASE1_TARGET_READINESS} before selection. That is a Zero Phase benchmark, not an official threshold, and it does not predict an outcome.`}
                </Text>
              ) : null}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
