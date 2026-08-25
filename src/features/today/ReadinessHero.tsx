import { View } from 'react-native';

import { DeltaBadge } from '@/components/data-display/DeltaBadge';
import { GridBackdrop } from '@/components/layout/GridBackdrop';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import type { ReadinessSnapshot, ReadinessTrend } from '@/domain/readiness/types';
import { useTheme } from '@/theme';

export interface ReadinessHeroProps {
  readiness: ReadinessSnapshot | null;
  trend: ReadinessTrend | null;
}

const LOW_COVERAGE_THRESHOLD = 0.7;

export function ReadinessHero({ readiness, trend }: ReadinessHeroProps) {
  const theme = useTheme();

  if (!readiness) {
    return (
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textTertiary">
          Readiness
        </Text>
        <Text variant="body" color="textSecondary">
          Log a baseline assessment to generate your first score.
        </Text>
      </Card>
    );
  }

  return (
    <Card padded={false} style={{ paddingVertical: theme.spacing.xxl }}>
      <GridBackdrop divisions={8} opacity={0.35} />
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
        <Text variant="label" color="textTertiary">
          Readiness
        </Text>
        <Text
          variant="display"
          accessibilityLabel={`Readiness ${readiness.overall} out of 100`}
        >
          {readiness.overall}
        </Text>
        {trend ? (
          <DeltaBadge delta={trend.delta} caption={`LAST ${trend.windowDays} DAYS`} />
        ) : null}
        {readiness.coverage < LOW_COVERAGE_THRESHOLD ? (
          <Text variant="caption" color="textTertiary" style={{ marginTop: theme.spacing.sm }}>
            Based on partial data. Complete an assessment for a fuller picture.
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
