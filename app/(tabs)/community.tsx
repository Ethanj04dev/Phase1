import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

/**
 * Community — staged deliberately.
 *
 * Nothing social is faked here: no placeholder feed, no imaginary
 * candidates. The tab exists so the app's shape is honest about where it is
 * going, and the copy says exactly what will and will not be built.
 */
export default function CommunityScreen() {
  const theme = useTheme();

  return (
    <Screen
      scroll
      testID="community-screen"
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <Text variant="title" accessibilityRole="header">
        Community
      </Text>

      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="headline">Coming after rankings</Text>
        <Text variant="body" color="textSecondary">
          Following other candidates, seeing their verified results and ranking moves,
          and recognising real performances — that arrives once there are verified
          performances to see.
        </Text>
        <Text variant="bodySm" color="textTertiary">
          Competition and preparation stay the focus. This will not become a generic
          social feed.
        </Text>
      </Card>
    </Screen>
  );
}
