import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { usePipeline } from '@/features/pipeline/usePipeline';
import { useTheme } from '@/theme';

/**
 * Rankings — the centrepiece of Zero Phase, not yet live.
 *
 * There is deliberately no fake leaderboard here. A board populated with
 * placeholder candidates would teach users that the numbers on this screen
 * are decoration, and this screen's entire value is that they never will be.
 * Until verification exists, the honest state is an explanation of what this
 * will be and the one rule it will follow.
 */
export default function RankingsScreen() {
  const theme = useTheme();
  const { state, reload } = usePipeline();

  return (
    <Screen
      scroll
      testID="rankings-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <Text variant="title" accessibilityRole="header">
        Rankings
      </Text>

      <AsyncBoundary state={state} onRetry={reload}>
        {({ pipeline, profile }) => (
          <>
            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="headline">Not live yet — on purpose</Text>
              <Text variant="body" color="textSecondary">
                Zero Phase rankings will compare candidates preparing for the same
                pipeline, nationally and by state. They launch after verification does,
                because a leaderboard is only worth having if every score on it can be
                trusted.
              </Text>
              <Text variant="bodySm" color="textTertiary">
                If a performance cannot be trusted, it cannot affect the leaderboard.
                Self-reported results will never rank; verified ones will.
              </Text>
            </Card>

            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="bodySm" color="textTertiary">
                What will rank
              </Text>
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="body" color="textSecondary">
                  {pipeline
                    ? `Your pipeline — ${pipeline.name} — will have its own board, built from verified assessment performances converted into a single 0–1000 rating.`
                    : 'Each pipeline will have its own board, built from verified assessment performances converted into a single 0–1000 rating.'}
                </Text>
                <Text variant="caption" color="textTertiary">
                  Zero Phase is an independent platform. Rankings here will describe
                  standing on Zero Phase only, never an official military standing.
                </Text>
              </Card>
            </View>

            <Text variant="caption" color="textTertiary">
              {`Until then: keep testing. Every result you log now stays with your profile${
                profile.selectionDate ? ' and your countdown' : ''
              }, and the work is what will move you when the board goes live.`}
            </Text>
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}
