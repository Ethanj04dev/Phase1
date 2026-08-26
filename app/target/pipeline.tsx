import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { preparationDomain } from '@/domain/target/domains';
import { verifiedValue, VERIFICATION_REQUIRED } from '@/domain/target/provenance';
import { useTarget } from '@/features/target/useTarget';
import { useTheme } from '@/theme';

export default function PipelineScreen() {
  const theme = useTheme();
  const { state, reload } = useTarget();

  return (
    <Screen
      scroll
      testID="target-pipeline"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ target }) => {
          if (!target || target.pipeline.length === 0) {
            return (
              <Text variant="body" color="textSecondary">
                Pipeline information is not yet available for your target.
              </Text>
            );
          }

          const anyPlaceholder = target.pipeline.some((stage) => stage.isPlaceholder);

          return (
            <>
              {/* Stated before the content, not after it. A caveat below a
                  timeline is a caveat nobody reads. */}
              {anyPlaceholder ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="headline" color="statusCaution">
                    Structure only
                  </Text>
                  <Text variant="bodySm" color="textSecondary">
                    These stages are a generic shape to orient by, not this career&apos;s
                    actual pipeline. Naming a real stage is a claim, and that has not been
                    verified against an authoritative source yet.
                  </Text>
                  <Text variant="bodySm" color="textSecondary">
                    Confirm the specifics with a recruiter or an official source.
                  </Text>
                </Card>
              ) : null}

              <View>
                {target.pipeline.map((stage, index) => {
                  const isLast = index === target.pipeline.length - 1;
                  const duration = stage.durationWeeks
                    ? verifiedValue(stage.durationWeeks)
                    : null;
                  const location = stage.location ? verifiedValue(stage.location) : null;

                  return (
                    <View key={stage.id} style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
                      {/* The spine of the timeline. */}
                      <View style={{ alignItems: 'center', width: 12 }}>
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            marginTop: 6,
                            backgroundColor: stage.isPlaceholder
                              ? theme.colors.borderStrong
                              : theme.colors.accent,
                          }}
                        />
                        {!isLast ? (
                          <View
                            style={{
                              flex: 1,
                              width: 1,
                              marginTop: theme.spacing.xs,
                              backgroundColor: theme.colors.border,
                            }}
                          />
                        ) : null}
                      </View>

                      <View
                        style={{
                          flex: 1,
                          paddingBottom: isLast ? 0 : theme.spacing.xl,
                          gap: theme.spacing.xs,
                        }}
                      >
                        <Text variant="headline">{stage.name}</Text>
                        <Text variant="bodySm" color="textSecondary">
                          {stage.summary}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
                          <Text variant="caption" color="textTertiary">
                            {duration === null
                              ? `Duration: ${VERIFICATION_REQUIRED}`
                              : `${duration} weeks`}
                          </Text>
                          {location === null ? null : (
                            <Text variant="caption" color="textTertiary">
                              {location}
                            </Text>
                          )}
                        </View>

                        {stage.emphasis.length > 0 ? (
                          <Text variant="caption" color="textTertiary">
                            {`Leans on: ${stage.emphasis
                              .map((id) => preparationDomain(id).label)
                              .join(', ')}`}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
