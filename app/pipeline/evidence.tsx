import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { findAssessmentEvent, latestResultByEvent } from '@/domain/assessment/types';
import { preparationDomain } from '@/domain/pipeline/domains';
import { formatEventValue } from '@/features/assessment/display';
import { usePipeline } from '@/features/pipeline/usePipeline';
import { formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * The arithmetic behind the number.
 *
 * A readiness score an athlete cannot audit is a black box, and the product
 * brief bans black boxes. This screen is the audit: which domains were
 * scored, from which results, at what weight, and exactly how they combine
 * into the number on the gauge. Nothing here is new data — it is the same
 * calculation the engine ran, shown rather than summarised.
 *
 * Competitors whose scoring is proprietary cannot ship this screen. That is
 * the point of shipping it.
 */
export default function EvidenceScreen() {
  const theme = useTheme();
  const { state, reload } = usePipeline();

  return (
    <Screen
      scroll
      testID="target-evidence"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ pipeline, readiness, results }) => {
          if (!pipeline || !readiness) {
            return (
              <Text variant="body" color="textSecondary">
                There is no readiness score to explain yet. Log an assessment and this
                screen will show exactly how the number is built.
              </Text>
            );
          }

          const latest = latestResultByEvent(results);
          const measured = pipeline.domains.filter(
            (domain) => readiness.domains[domain.id] !== undefined,
          );
          const unmeasured = pipeline.domains.filter(
            (domain) => readiness.domains[domain.id] === undefined,
          );

          const coveredWeight = measured.reduce((sum, domain) => sum + domain.weight, 0);
          const weightedTotal = measured.reduce(
            (sum, domain) => sum + (readiness.domains[domain.id] ?? 0) * domain.weight,
            0,
          );

          return (
            <>
              <Text variant="body" color="textSecondary">
                {`Your ${readiness.overall} is not a verdict from a model. It is this arithmetic, and every line of it is yours to check.`}
              </Text>

              {/* Step 1: what was measured, and from what. */}
              <View>
                <Text
                  variant="bodySm"
                  color="textTertiary"
                  style={{ marginBottom: theme.spacing.md }}
                >
                  What was measured
                </Text>
                <Card padded={false}>
                  {measured.map((domain, index) => {
                    const info = preparationDomain(domain.id);
                    const score = readiness.domains[domain.id] ?? 0;
                    const events = domain.eventIds
                      .map((id) => {
                        const event = findAssessmentEvent(id);
                        const result = latest.get(id);
                        return event && result
                          ? `${event.name} ${formatEventValue(event, result.value)}`
                          : null;
                      })
                      .filter((line): line is string => line !== null);

                    return (
                      <View key={domain.id}>
                        {index > 0 ? <Divider /> : null}
                        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xs }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: theme.spacing.md,
                            }}
                          >
                            <Text variant="headline" style={{ flex: 1 }}>
                              {info.label}
                            </Text>
                            <Text variant="metricMd">{score}</Text>
                          </View>
                          {events.length > 0 ? (
                            <Text variant="bodySm" color="textSecondary">
                              {`From your latest: ${events.join(' · ')}`}
                            </Text>
                          ) : (
                            <Text variant="bodySm" color="textSecondary">
                              {info.measurement === 'proficiency'
                                ? 'From your own skill ratings.'
                                : 'From your training history.'}
                            </Text>
                          )}
                          <Text variant="caption" color="textTertiary">
                            {`${score} × ${formatPercent(domain.weight)} weight = ${(score * domain.weight).toFixed(1)} points`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </View>

              {/* Step 2: the combination, spelled out. */}
              <View>
                <Text
                  variant="bodySm"
                  color="textTertiary"
                  style={{ marginBottom: theme.spacing.md }}
                >
                  How it combines
                </Text>
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="bodySm" color="textSecondary">
                    {`The weighted points sum to ${weightedTotal.toFixed(1)}. The measured domains cover ${formatPercent(coveredWeight)} of this pipeline's weighting, so the sum is divided by ${coveredWeight.toFixed(2)} rather than by 1 — you are scored on what was measured, not punished with zeros for what was not.`}
                  </Text>
                  {/* The formula as data, not prose. */}
                  <Text variant="mono" color="textPrimary">
                    {`${weightedTotal.toFixed(1)} / ${coveredWeight.toFixed(2)} = ${(weightedTotal / Math.max(coveredWeight, 0.0001)).toFixed(1)} → ${readiness.overall}`}
                  </Text>
                  <Text variant="caption" color="textTertiary">
                    Rounded to the nearest whole point. Same arithmetic, every time, no
                    model in the loop.
                  </Text>
                </Card>
              </View>

              {/* Step 3: what the number does not know. */}
              {unmeasured.length > 0 ? (
                <View>
                  <Text
                    variant="bodySm"
                    color="textTertiary"
                    style={{ marginBottom: theme.spacing.md }}
                  >
                    What it does not know
                  </Text>
                  <Card padded={false}>
                    {unmeasured.map((domain, index) => (
                      <View key={domain.id}>
                        {index > 0 ? <Divider /> : null}
                        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: theme.spacing.md,
                            }}
                          >
                            <Text variant="headline" style={{ flex: 1 }}>
                              {preparationDomain(domain.id).label}
                            </Text>
                            <Text variant="bodySm" color="textTertiary">
                              {`${formatPercent(domain.weight)} unmeasured`}
                            </Text>
                          </View>
                          <Text variant="caption" color="textTertiary">
                            Contributes nothing — not a zero, an absence. This is the open
                            section of the gauge.
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>
              ) : null}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
