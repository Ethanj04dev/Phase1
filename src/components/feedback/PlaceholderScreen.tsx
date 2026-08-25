import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface PlaceholderScreenProps {
  title: string;
  summary: string;
  /** What will live here, in build order. */
  upcoming: readonly string[];
  testID?: string;
}

/**
 * Honest scaffolding for tabs that are routed but not yet built.
 *
 * It uses the real design system rather than placeholder text, so the shell
 * can be reviewed as a whole and each screen has somewhere to grow into.
 */
export function PlaceholderScreen({
  title,
  summary,
  upcoming,
  testID,
}: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <Screen
      scroll
      testID={testID}
      contentContainerStyle={{
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">{title}</Text>
        <Text variant="body" color="textSecondary">
          {summary}
        </Text>
      </View>

      <View>
        <SectionHeader title="Planned" />
        <Card padded={false}>
          {upcoming.map((item, index) => (
            <View key={item}>
              {index > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.lg,
                  paddingHorizontal: theme.spacing.lg,
                }}
              >
                <Text variant="mono" color="textTertiary">
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Text variant="body" style={{ flex: 1 }}>
                  {item}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
