import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { Text } from '@/components/primitives/Text';
import { DEMAND_LEVEL_LABELS, demandRank, preparationDomain } from '@/domain/target/domains';
import { useTarget } from '@/features/target/useTarget';
import { useTheme } from '@/theme';

export default function PhysicalDemandsScreen() {
  const theme = useTheme();
  const { state, reload } = useTarget();

  return (
    <Screen
      scroll
      testID="target-demands"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ target }) => {
          if (!target) {
            return (
              <Text variant="body" color="textSecondary">
                Physical demands are not yet available for your target.
              </Text>
            );
          }

          // Heaviest demands first: the point of the screen is what matters
          // most, not an alphabetical list.
          const ordered = [...target.domains].sort(
            (a, b) => demandRank(b.demand) - demandRank(a.demand) || b.weight - a.weight,
          );

          return (
            <>
              <Text variant="body" color="textSecondary">
                {`What ${target.name} asks of you physically, and why each area matters. This is Zero Phase's assessment of the preparation demands, not an official document.`}
              </Text>

              <Card padded={false}>
                {ordered.map((domain, index) => {
                  const info = preparationDomain(domain.id);
                  return (
                    <View key={domain.id}>
                      {index > 0 ? <Divider /> : null}
                      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
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
                          <Text
                            variant="bodySm"
                            color={
                              demandRank(domain.demand) >= demandRank('very_high')
                                ? 'accent'
                                : 'textSecondary'
                            }
                          >
                            {DEMAND_LEVEL_LABELS[domain.demand]}
                          </Text>
                        </View>

                        {/* Weight, shown honestly as a share of the score
                            rather than hidden inside the algorithm. */}
                        <ProgressBar
                          value={domain.weight}
                          accessibilityLabel={`${info.label} is ${Math.round(domain.weight * 100)} percent of your readiness score`}
                        />

                        <Text variant="bodySm" color="textSecondary">
                          {domain.rationale}
                        </Text>
                        <Text variant="caption" color="textTertiary">
                          {`${Math.round(domain.weight * 100)}% of your readiness score`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
