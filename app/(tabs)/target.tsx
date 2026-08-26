import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { NavRow } from '@/components/layout/NavRow';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { READINESS_BAND_DESCRIPTIONS, READINESS_BAND_LABELS, readinessBand } from '@/domain/readiness/bands';
import { preparationDomain } from '@/domain/target/domains';
import { useTarget } from '@/features/target/useTarget';
import { formatPercent } from '@/lib/format';
import { useTheme } from '@/theme';

export default function TargetScreen() {
  const theme = useTheme();
  const { state, reload } = useTarget();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <Screen
      scroll
      testID="target-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ target, readiness }) => {
          if (!target) {
            // Honest rather than empty. Only Pararescue is modelled so far,
            // and saying so beats an inert screen that looks broken.
            return (
              <>
                <Text variant="title" accessibilityRole="header">
                  Your target
                </Text>
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="headline">Not yet available</Text>
                  <Text variant="body" color="textSecondary">
                    Full target information is being built one career at a time, starting
                    with Pararescue. Your training, assessments and readiness all still
                    work as normal.
                  </Text>
                </Card>
              </>
            );
          }

          const band = readiness ? readinessBand(readiness.overall) : null;

          return (
            <>
              <View style={{ gap: theme.spacing.xs }}>
                <Text variant="bodySm" color="textTertiary">
                  Your target
                </Text>
                <Text variant="title" accessibilityRole="header">
                  {target.name}
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  {target.category}
                </Text>
              </View>

              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="bodySm" color="textTertiary">
                  Readiness
                </Text>
                {readiness && band ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.md }}>
                      <Text
                        variant="metricXl"
                        accessibilityLabel={`Readiness ${readiness.overall} out of 100, ${READINESS_BAND_LABELS[band]}`}
                      >
                        {readiness.overall}
                      </Text>
                      <Text variant="headline" color="accent">
                        {READINESS_BAND_LABELS[band]}
                      </Text>
                    </View>
                    <Text variant="bodySm" color="textSecondary">
                      {READINESS_BAND_DESCRIPTIONS[band]}
                    </Text>
                    <Text variant="caption" color="textTertiary">
                      {`Based on ${formatPercent(readiness.coverage)} of what this target measures.`}
                    </Text>
                  </>
                ) : (
                  <Text variant="body" color="textSecondary">
                    Log an assessment to generate your readiness for this target.
                  </Text>
                )}
              </Card>

              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="bodySm" color="textTertiary">
                  {target.description}
                </Text>
              </View>

              {/* Drill-downs. Sections appear here as they are built, so there
                  are never rows that lead nowhere. */}
              <Card padded={false}>
                <NavRow
                  title="Physical demands"
                  subtitle="What this career asks of you, and why"
                  meta={`${target.domains.length}`}
                  onPress={() => router.push('/target/demands')}
                />
                <Divider />
                <NavRow
                  title="Pipeline"
                  subtitle="The shape of the journey"
                  meta={target.pipeline.some((s) => s.isPlaceholder) ? 'Unverified' : undefined}
                  onPress={() => router.push('/target/pipeline')}
                />
                <Divider />
                <NavRow
                  title="Career intel"
                  subtitle="What you are getting into"
                  meta={`${target.intel.length}`}
                  onPress={() => router.push('/target/intel')}
                />
              </Card>

              {readiness ? (
                <View>
                  <Text
                    variant="bodySm"
                    color="textTertiary"
                    style={{ marginBottom: theme.spacing.md }}
                  >
                    Where you stand
                  </Text>
                  <Card padded={false}>
                    {target.domains.map((domain, index) => {
                      const score = readiness.domains[domain.id];
                      const info = preparationDomain(domain.id);
                      return (
                        <View key={domain.id}>
                          {index > 0 ? <Divider /> : null}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: theme.spacing.md,
                              paddingVertical: theme.spacing.md,
                              paddingHorizontal: theme.spacing.lg,
                            }}
                          >
                            <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                              {info.label}
                            </Text>
                            {score === undefined ? (
                              <Text variant="bodySm" color="textTertiary">
                                Not measured
                              </Text>
                            ) : (
                              <Text variant="metricMd">{score}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
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
