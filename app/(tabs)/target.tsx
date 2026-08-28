import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { ReadinessGauge } from '@/components/charts/ReadinessGauge';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { NavRow } from '@/components/layout/NavRow';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { READINESS_BAND_DESCRIPTIONS, READINESS_BAND_LABELS, readinessBand } from '@/domain/readiness/bands';
import { preparationDomain } from '@/domain/target/domains';
import { ratedCount, skillStandings } from '@/domain/target/proficiency';
import { roadStepInstruction } from '@/features/target/roadCopy';
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
        {({ target, readiness, road, ratings }) => {
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
          const skillDomains = target.domains.filter(
            (domain) => (domain.proficiencySkills?.length ?? 0) > 0,
          );

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

              <Card style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
                {readiness && band ? (
                  <>
                    <ReadinessGauge
                      score={readiness.overall}
                      coverage={readiness.coverage}
                      caption={READINESS_BAND_LABELS[band]}
                      accessibilityLabel={`Readiness ${readiness.overall} out of 100, ${READINESS_BAND_LABELS[band]}, measured on ${formatPercent(readiness.coverage)} of this target`}
                    />
                    <Text variant="bodySm" color="textSecondary" align="center">
                      {READINESS_BAND_DESCRIPTIONS[band]}
                    </Text>
                    {/* The gap in the arc, said in words as well as drawn. */}
                    {readiness.coverage < 1 ? (
                      <Text variant="caption" color="textTertiary" align="center">
                        {`The open section is the ${formatPercent(1 - readiness.coverage)} of this target not yet measured.`}
                      </Text>
                    ) : null}
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

              {/* The one instruction the screen exists to give. Above the
                  navigation, because it is the answer, not a destination. */}
              {road?.focus ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Road to ready. Start with ${preparationDomain(road.focus.domainId).label}`}
                  onPress={() => router.push('/target/road')}
                >
                  <Card style={{ gap: theme.spacing.sm }}>
                    <Text variant="bodySm" color="textTertiary">
                      Road to ready
                    </Text>
                    <Text variant="title">
                      {`Start with ${preparationDomain(road.focus.domainId).label.toLowerCase()}`}
                    </Text>
                    <Text variant="bodySm" color="textSecondary">
                      {roadStepInstruction(road.focus)}
                    </Text>
                    <Text variant="caption" color="accent">
                      See the full list ›
                    </Text>
                  </Card>
                </Pressable>
              ) : null}

              {/* Drill-downs. Sections appear here as they are built, so there
                  are never rows that lead nowhere. */}
              <Card padded={false}>
                <NavRow
                  title="Road to ready"
                  subtitle="What to work on, in order of what it is worth"
                  meta={road && road.focus ? `${road.steps.filter((s) => s.impact > 0).length}` : undefined}
                  metaAccent
                  onPress={() => router.push('/target/road')}
                />
                <Divider />
                <NavRow
                  title="Fitness"
                  subtitle="Your numbers against the benchmarks"
                  meta={`${target.phase1Benchmarks.length}`}
                  onPress={() => router.push('/target/fitness')}
                />
                {/* Named for the domain rather than filed under a generic
                    "Skills", so water confidence reads as the first-class
                    thing it is for this career. */}
                {skillDomains.map((domain) => {
                  const counts = ratedCount(skillStandings(domain, ratings));
                  return (
                    <View key={domain.id}>
                      <Divider />
                      <NavRow
                        title={preparationDomain(domain.id).label}
                        subtitle="Rate yourself against named skills"
                        meta={`${counts.rated}/${counts.total}`}
                        metaAccent={counts.rated < counts.total}
                        onPress={() => router.push('/target/skills')}
                      />
                    </View>
                  );
                })}
                <Divider />
                <NavRow
                  title="Physical demands"
                  subtitle="What this career asks of you, and why"
                  meta={`${target.domains.length}`}
                  onPress={() => router.push('/target/demands')}
                />
                <Divider />
                <NavRow
                  title="Milestones"
                  subtitle="Your own record of where you are in the process"
                  meta={`${target.milestones.length}`}
                  onPress={() => router.push('/target/milestones')}
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
