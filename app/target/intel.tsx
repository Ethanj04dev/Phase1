import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import type { IntelCategory } from '@/domain/target/types';
import { useTarget } from '@/features/target/useTarget';
import { useTheme } from '@/theme';

const CATEGORY_LABELS: Record<IntelCategory, string> = {
  mission: 'Mission',
  role: 'Role',
  pipeline: 'Pipeline',
  fitness: 'Fitness',
  assessments: 'Assessments',
  preparation: 'Preparation',
  faq: 'Common questions',
  terminology: 'Terminology',
};

export default function CareerIntelScreen() {
  const theme = useTheme();
  const { state, reload } = useTarget();

  return (
    <Screen
      scroll
      testID="target-intel"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ target }) => {
          if (!target || target.intel.length === 0) {
            return (
              <Text variant="body" color="textSecondary">
                Career information is not yet available for your target.
              </Text>
            );
          }

          return (
            <>
              <Text variant="body" color="textSecondary">
                Understanding what you are pursuing, without piecing it together from a
                dozen sources.
              </Text>

              {target.intel.map((article) => (
                <View key={article.id} style={{ gap: theme.spacing.md }}>
                  <Text variant="bodySm" color="textTertiary">
                    {CATEGORY_LABELS[article.category]}
                  </Text>
                  <Card style={{ gap: theme.spacing.md }}>
                    <Text variant="headline">{article.title}</Text>
                    {/* Prose, not bullet points. This is material someone reads
                        once and needs to understand, not scan. */}
                    {article.body.map((paragraph, index) => (
                      <Text key={index} variant="body" color="textSecondary">
                        {paragraph}
                      </Text>
                    ))}
                    {article.sourceIds && article.sourceIds.length > 0 ? (
                      <Text variant="caption" color="textTertiary">
                        {`Sources: ${article.sourceIds.length}`}
                      </Text>
                    ) : null}
                  </Card>
                </View>
              ))}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
