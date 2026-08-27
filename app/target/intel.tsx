import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import type { Source } from '@/domain/target/provenance';
import type { IntelArticle, IntelCategory, TargetDefinition } from '@/domain/target/types';
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

/**
 * The sources an article actually cites.
 *
 * An id with no matching source is dropped rather than rendered as a dangling
 * reference. A content test already asserts that verified figures point at
 * real sources; this is the same rule applied where prose does the claiming.
 */
function sourcesFor(target: TargetDefinition, article: IntelArticle): readonly Source[] {
  return (article.sourceIds ?? []).flatMap((id) => {
    const source = target.sources.find((candidate) => candidate.id === id);
    return source ? [source] : [];
  });
}

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
                    {/* Named, not counted. "Sources: 2" is not a citation,
                        and an athlete cannot check a number. */}
                    {sourcesFor(target, article).map((source) => (
                      <Text key={source.id} variant="caption" color="textTertiary">
                        {`${source.title} — ${source.organization}`}
                      </Text>
                    ))}
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
