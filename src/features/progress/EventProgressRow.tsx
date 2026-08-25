import { Pressable, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import type { EventProgress } from '@/domain/assessment/records';
import { formatEventDelta, formatEventValue } from '@/features/assessment/display';
import { useTheme } from '@/theme';

export interface EventProgressRowProps {
  progress: EventProgress;
  onPress: () => void;
}

/**
 * One event in the progress list: where the athlete is now, and how far that
 * has moved since they first tested it.
 */
export function EventProgressRow({ progress, onPress }: EventProgressRowProps) {
  const theme = useTheme();
  const { event, latest, improvement, history } = progress;

  if (!latest) {
    return null;
  }

  const improved = improvement !== null && improvement > 0;
  const declined = improvement !== null && improvement < 0;

  const changeColor = improved
    ? theme.colors.statusOnTarget
    : declined
      ? theme.colors.statusOffTarget
      : theme.colors.textTertiary;

  const changeLabel =
    improvement === null
      ? 'FIRST TEST'
      : improvement === 0
        ? 'NO CHANGE'
        : `${improved ? '+' : '-'}${formatEventDelta(event, improvement)}`;

  const accessibilityLabel = [
    event.name,
    formatEventValue(event, latest.value),
    improvement === null
      ? 'first test'
      : improved
        ? `improved by ${formatEventDelta(event, improvement)}`
        : declined
          ? `down by ${formatEventDelta(event, improvement)}`
          : 'no change',
  ].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the full history for this event"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.minTouchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.transparent,
      })}
    >
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="headline" numberOfLines={1}>
          {event.name}
        </Text>
        <Text variant="monoSm" color="textTertiary">
          {`${history.length} ${history.length === 1 ? 'TEST' : 'TESTS'}`}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: theme.spacing.xxs }}>
        <Text variant="metricMd">{formatEventValue(event, latest.value)}</Text>
        <Text variant="labelSm" style={{ color: changeColor }}>
          {changeLabel}
        </Text>
      </View>
    </Pressable>
  );
}
