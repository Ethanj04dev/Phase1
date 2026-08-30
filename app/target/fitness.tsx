import { View } from 'react-native';

import { ProvenanceMark } from '@/components/data-display/ProvenanceMark';
import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import {
  findAssessmentEvent,
  latestResultByEvent,
  type AssessmentEvent,
} from '@/domain/assessment/types';
import { preparationDomain } from '@/domain/target/domains';
import { verifiedValue } from '@/domain/target/provenance';
import {
  officialStandardFor,
  phase1BenchmarkFor,
  type TargetDefinition,
  type TargetDomain,
} from '@/domain/target/types';
import { formatEventValue } from '@/features/assessment/display';
import { useTarget } from '@/features/target/useTarget';
import { useTheme } from '@/theme';

/**
 * Why a domain has no timed test.
 *
 * "Not assessed" would be wrong for water confidence, which is assessed --
 * just against named skills rather than a clock. The distinction matters,
 * because one of these is a measurement choice and the other is a safety one.
 */
function measurementNote(domain: TargetDomain): string {
  if ((domain.proficiencySkills?.length ?? 0) > 0) {
    return 'rated against named skills rather than timed';
  }
  return preparationDomain(domain.id).measurement === 'behavioural'
    ? 'comes from your training history, not a test'
    : 'no safe assessment exists yet, so it carries no score';
}

/**
 * One labelled figure. Two of these sit side by side, and the label is what
 * stops them being read as the same kind of number.
 */
function Figure({
  label,
  value,
  color = 'textPrimary',
}: {
  label: string;
  value: string;
  color?: 'textPrimary' | 'accent' | 'textTertiary';
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, gap: theme.spacing.xxs }}>
      <Text variant="caption" color="textTertiary">
        {label}
      </Text>
      <Text variant="metricMd" color={color} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function EventRow({
  event,
  target,
  current,
}: {
  event: AssessmentEvent;
  target: TargetDefinition;
  current: number | null;
}) {
  const theme = useTheme();
  const benchmark = phase1BenchmarkFor(target, event.id);
  const standard = officialStandardFor(target, event.id);
  // Absent until sourced. There is no fallback number, by design.
  const official = standard ? verifiedValue(standard.requirement) : null;

  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Text variant="headline">{event.name}</Text>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Figure
          label="Your best"
          value={current === null ? '—' : formatEventValue(event, current)}
          color={current === null ? 'textTertiary' : 'textPrimary'}
        />
        <Figure
          label="Zero Phase target"
          value={benchmark ? formatEventValue(event, benchmark.target) : '—'}
          color="accent"
        />
      </View>

      {/* The official figure gets its own row rather than a third column,
          because a blank in a row of numbers reads as a missing value the app
          failed to load, rather than as a claim nobody has verified. The mark
          is the calibration sticker: solid and sourced, or hollow and
          honest. */}
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="caption" color="textTertiary">
          Official standard
        </Text>
        {official !== null ? (
          <Text variant="bodySm" color="textPrimary">
            {`${formatEventValue(event, official.value)}${official.qualifier ? ` — ${official.qualifier}` : ''}`}
          </Text>
        ) : null}
        {standard ? (
          <ProvenanceMark value={standard.requirement} sources={target.sources} />
        ) : (
          // A third state, worded differently on purpose. "Verification
          // required" means a standard exists and has not been sourced; this
          // means the career field is not known to test this event at all.
          <Text variant="caption" color="textTertiary">
            No official standard on file for this event.
          </Text>
        )}
      </View>

      {benchmark ? (
        <Text variant="bodySm" color="textSecondary">
          {benchmark.rationale}
        </Text>
      ) : null}

      <Text variant="caption" color="textTertiary">
        {event.protocol}
      </Text>
    </View>
  );
}

export default function FitnessScreen() {
  const theme = useTheme();
  const { state, reload } = useTarget();

  return (
    <Screen
      scroll
      testID="target-fitness"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ target, results }) => {
          if (!target) {
            return (
              <Text variant="body" color="textSecondary">
                Fitness standards are not yet available for your target.
              </Text>
            );
          }

          const latest = latestResultByEvent(results);

          return (
            <>
              {/* The distinction this whole screen exists to make. */}
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="headline">Two different numbers</Text>
                <Text variant="bodySm" color="textSecondary">
                  An official standard is what the career field publishes. A Zero Phase target is
                  what this app thinks you should be able to do to arrive prepared rather than
                  merely eligible.
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  They are never the same thing, so they are never shown as the same thing.
                  Where an official figure has not been sourced from an authoritative document,
                  it stays blank instead of being filled in with something plausible.
                </Text>
              </Card>

              {target.domains.map((domain) => {
                const events = domain.eventIds
                  .map((id) => findAssessmentEvent(id))
                  .filter((event): event is AssessmentEvent => event !== undefined);
                if (events.length === 0) {
                  return null;
                }
                const info = preparationDomain(domain.id);

                return (
                  <View key={domain.id}>
                    <Text
                      variant="bodySm"
                      color="textTertiary"
                      style={{ marginBottom: theme.spacing.md }}
                    >
                      {info.label}
                    </Text>
                    <Card padded={false}>
                      {events.map((event, index) => (
                        <View key={event.id}>
                          {index > 0 ? <Divider /> : null}
                          <EventRow
                            event={event}
                            target={target}
                            current={latest.get(event.id)?.value ?? null}
                          />
                        </View>
                      ))}
                    </Card>
                  </View>
                );
              })}

              {/* Domains with no timed or counted test are named rather than
                  omitted, so their absence from this screen is a stated
                  decision instead of a gap. */}
              {target.domains.some((domain) => domain.eventIds.length === 0) ? (
                <Card style={{ gap: theme.spacing.md }}>
                  <Text variant="headline">Measured differently</Text>
                  <Text variant="bodySm" color="textSecondary">
                    These count towards your readiness, but not through a stopwatch or a rep
                    count.
                  </Text>
                  {target.domains
                    .filter((domain) => domain.eventIds.length === 0)
                    .map((domain) => (
                      <View key={domain.id} style={{ gap: theme.spacing.xxs }}>
                        <Text variant="bodySm">
                          {`${preparationDomain(domain.id).label} — ${measurementNote(domain)}`}
                        </Text>
                        <Text variant="caption" color="textTertiary">
                          {domain.rationale}
                        </Text>
                      </View>
                    ))}
                </Card>
              ) : null}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
