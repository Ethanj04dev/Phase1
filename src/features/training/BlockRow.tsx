import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import type { AssessmentResult } from '@/domain/assessment/types';
import { resolvePaceTarget } from '@/domain/training/targets';
import type { WorkoutBlock } from '@/domain/training/types';
import { formatDistance, formatDuration, formatDurationRange } from '@/lib/format';
import { useTheme } from '@/theme';

export interface BlockRowProps {
  block: WorkoutBlock;
  /** Used to resolve declared pace relationships into real numbers. */
  results: readonly AssessmentResult[];
}

/** The headline prescription, e.g. "6 x 800m" or "4 x 8". */
function prescription(block: WorkoutBlock): string {
  switch (block.kind) {
    case 'interval':
    case 'swim':
      return `${block.reps} x ${formatDistance(block.distanceMeters)}`;
    case 'steady':
      if (block.distanceMeters !== undefined) return formatDistance(block.distanceMeters);
      return block.durationSeconds === undefined ? '' : formatDuration(block.durationSeconds);
    case 'ruck':
      return `${formatDistance(block.distanceMeters)} @ ${block.loadPounds} lb`;
    case 'strength':
      return `${block.sets} x ${block.reps}`;
    case 'calisthenics':
      return `${block.sets} x ${block.reps === 'max' ? 'max' : block.reps}`;
    case 'recovery':
      return formatDuration(block.durationSeconds);
  }
}

/** Distance of one repetition, for resolving a pace target. */
function repDistance(block: WorkoutBlock): number | null {
  switch (block.kind) {
    case 'interval':
    case 'swim':
      return block.distanceMeters;
    case 'steady':
      return block.distanceMeters ?? null;
    case 'ruck':
      return block.distanceMeters;
    default:
      return null;
  }
}

function restLine(block: WorkoutBlock): string | null {
  switch (block.kind) {
    case 'interval':
      return `${formatDuration(block.recoverySeconds)} recovery`;
    case 'swim':
      return `${formatDuration(block.restSeconds)} rest`;
    case 'strength':
    case 'calisthenics':
      return `${formatDuration(block.restSeconds)} rest`;
    default:
      return null;
  }
}

export function BlockRow({ block, results }: BlockRowProps) {
  const theme = useTheme();

  const target =
    'target' in block && block.target
      ? resolvePaceTarget(block.target, repDistance(block) ?? 0, results)
      : null;

  const effort = 'effort' in block && block.effort ? block.effort : null;
  const rest = restLine(block);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <Text variant="headline" style={{ flex: 1 }} numberOfLines={2}>
          {block.name}
        </Text>
        <Text variant="mono" color="textSecondary">
          {prescription(block)}
        </Text>
      </View>

      {target ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <Text variant="labelSm" color="textTertiary">
            {target.estimated ? 'TARGET (ESTIMATED)' : 'TARGET'}
          </Text>
          <Text variant="metricMd" color="accent">
            {formatDurationRange(target.lowSeconds, target.highSeconds)}
          </Text>
        </View>
      ) : null}

      {/*
        No target means the athlete has not tested the basis event. An effort
        prescription is the honest fallback; inventing a time from nothing
        would be worse than asking them to run by feel.
      */}
      {!target && effort ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="labelSm" color="textTertiary">
            EFFORT
          </Text>
          <Text variant="labelSm" color="textSecondary">
            {`RPE ${effort.rpe} / 10`}
          </Text>
        </View>
      ) : null}

      {!target && !effort && 'target' in block && block.target ? (
        <Text variant="caption" color="textTertiary">
          Run by feel. Test your {block.target.basis === 'swim_500_time' ? 'swim' : 'run'} to
          get a target here.
        </Text>
      ) : null}

      {rest ? (
        <Text variant="monoSm" color="textTertiary">
          {rest.toUpperCase()}
        </Text>
      ) : null}

      {block.kind === 'recovery' ? (
        <Text variant="bodySm" color="textSecondary">
          {block.description}
        </Text>
      ) : null}

      {block.notes ? (
        <Text variant="caption" color="textTertiary">
          {block.notes}
        </Text>
      ) : null}
    </View>
  );
}
