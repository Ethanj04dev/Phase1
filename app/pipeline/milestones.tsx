import { Pressable, View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import type { MilestoneStanding } from '@/domain/pipeline/milestones';
import { useMilestones } from '@/features/pipeline/useMilestones';
import { formatDateStamp } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * The athlete's own preparation checklist.
 *
 * Deliberately not a process guide. Zero Phase is not an authority on how anyone
 * joins a career field, routes differ, and people do these steps out of order.
 * So nothing is gated, nothing is required, and the order is a suggestion the
 * athlete is free to ignore.
 *
 * It records that they say a step is done. It has no way to know whether it
 * is, and does not pretend otherwise.
 */

function MilestoneRow({
  standing,
  busy,
  onToggle,
}: {
  standing: MilestoneStanding;
  busy: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const done = standing.completedAt !== null;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, busy }}
      accessibilityLabel={standing.milestone.label}
      accessibilityHint={done ? 'Marks this as not done' : 'Marks this as done'}
      disabled={busy}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.minTouchTarget,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        opacity: busy ? 0.6 : 1,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.transparent,
      })}
    >
      {/* A box that fills, rather than a tick that appears from nowhere. The
          empty state has to read as "not yet", not as "missing". */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radii.sm,
          borderWidth: theme.hairline.width,
          borderColor: done ? theme.colors.accent : theme.colors.borderStrong,
          backgroundColor: done ? theme.colors.accent : theme.colors.transparent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? (
          <Text variant="bodySm" color="textOnAccent">
            ✓
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="headline" color={done ? 'textSecondary' : 'textPrimary'}>
          {standing.milestone.label}
        </Text>
        <Text variant="bodySm" color="textTertiary">
          {standing.milestone.description}
        </Text>
      </View>

      {standing.completedAt ? (
        <Text variant="monoSm" color="textTertiary">
          {formatDateStamp(new Date(standing.completedAt))}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function MilestonesScreen() {
  const theme = useTheme();
  const { state, reload, toggle, pending, error } = useMilestones();

  return (
    <Screen
      scroll
      testID="target-milestones"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {(data) => {
          if (!data.target || data.standings.length === 0) {
            return (
              <Text variant="body" color="textSecondary">
                Milestones are not yet available for your pipeline.
              </Text>
            );
          }

          return (
            <>
              <Text variant="body" color="textSecondary">
                Your own record of where you are in the process. Zero Phase is not an authority
                on how anyone joins a career field: the order below is a suggestion, nothing
                here is required, and steps get done out of order all the time.
              </Text>

              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="title">
                  {`${data.progress.completed} of ${data.progress.total} marked done`}
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  {data.suggestedNext
                    ? `Suggested next: ${data.suggestedNext.label.toLowerCase()}.`
                    : 'You have marked every step on this list.'}
                </Text>
                {/* Said plainly rather than implied. The app is a notebook
                    here, not a verifier. */}
                <Text variant="caption" color="textTertiary">
                  Zero Phase records what you tell it. It cannot confirm any of these, and none
                  of it is reported anywhere.
                </Text>
              </Card>

              {error ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="headline" color="statusOffTarget">
                    Not saved
                  </Text>
                  <Text variant="bodySm" color="textSecondary">
                    {error}
                  </Text>
                </Card>
              ) : null}

              <Card padded={false}>
                {data.standings.map((standing, index) => (
                  <View key={standing.milestone.id}>
                    {index > 0 ? <Divider /> : null}
                    <MilestoneRow
                      standing={standing}
                      busy={pending.has(standing.milestone.id)}
                      onToggle={() =>
                        toggle(standing.milestone.id, standing.completedAt === null)
                      }
                    />
                  </View>
                ))}
              </Card>

              <Text variant="caption" color="textTertiary">
                Dates are when you marked the step, not when it happened.
              </Text>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
