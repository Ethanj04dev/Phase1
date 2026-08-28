import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { disclaimers } from '@/config/disclaimers';
import type { WorkoutSession } from '@/domain/training/types';
import { useTheme } from '@/theme';

/**
 * The water rule, on the session itself.
 *
 * A safety notice in a settings screen is a notice nobody reads. This renders
 * wherever a day or an active workout includes water work, above the content,
 * because the person about to train is the person it exists for. Carried over
 * from step 9 of the Target refactor, where it was named as owed.
 */
export function sessionsIncludeWater(
  sessions: readonly WorkoutSession[] | undefined,
): boolean {
  return (sessions ?? []).some((session) => session.modality === 'swimming');
}

export function WaterSafetyNotice() {
  const theme = useTheme();
  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <Text variant="headline" color="statusCaution">
        Water session
      </Text>
      <Text variant="bodySm" color="textSecondary">
        {disclaimers.water}
      </Text>
    </Card>
  );
}
