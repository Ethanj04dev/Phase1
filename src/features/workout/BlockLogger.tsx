import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import type { AssessmentResult } from '@/domain/assessment/types';
import {
  entriesForBlock,
  expectedReps,
  verdictFor,
  type RepVerdict,
} from '@/domain/training/session';
import { resolvePaceTarget, type ResolvedTarget } from '@/domain/training/targets';
import type { ActiveEntry, ActiveSession, WorkoutBlock } from '@/domain/training/types';
import { formatDistance, formatDurationRange } from '@/lib/format';
import { parseDurationInput, parseRepsInput, toDurationInput } from '@/lib/parse';
import { useTheme, type Theme } from '@/theme';

export interface BlockLoggerProps {
  block: WorkoutBlock;
  session: ActiveSession;
  results: readonly AssessmentResult[];
  onLog: (entry: Omit<ActiveEntry, 'recordedAt'>) => void;
  onClear: (blockId: string, repIndex: number) => void;
}

/** Whether a block is logged in time or in repetitions. */
function logsDuration(block: WorkoutBlock): boolean {
  return (
    block.kind === 'interval' ||
    block.kind === 'swim' ||
    block.kind === 'steady' ||
    block.kind === 'ruck' ||
    block.kind === 'recovery'
  );
}

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

function verdictColor(theme: Theme, verdict: RepVerdict): string {
  switch (verdict) {
    case 'on_target':
      return theme.colors.statusOnTarget;
    case 'slower':
      return theme.colors.statusOffTarget;
    case 'faster':
      return theme.colors.statusCaution;
    case 'unknown':
      return theme.colors.textTertiary;
  }
}

const VERDICT_LABEL: Record<RepVerdict, string> = {
  on_target: 'On target',
  // Not praise: on a controlled interval, well under the window usually means
  // burning a session that was meant to be held back.
  faster: 'Under',
  slower: 'Over',
  unknown: '',
};

interface RepRowProps {
  index: number;
  block: WorkoutBlock;
  entry: ActiveEntry | undefined;
  target: ResolvedTarget | null;
  duration: boolean;
  onLog: (value: number) => void;
  onClear: () => void;
}

function RepRow({ index, block, entry, target, duration, onLog, onClear }: RepRowProps) {
  const theme = useTheme();

  const logged = duration ? entry?.durationSeconds : entry?.reps;
  const [text, setText] = useState(() => {
    if (logged === undefined) return '';
    return duration ? toDurationInput(logged) : String(logged);
  });

  const verdict = duration ? verdictFor(target, entry?.durationSeconds ?? 0) : 'unknown';
  const complete = logged !== undefined;

  const commit = (next: string) => {
    setText(next);
    if (next.trim().length === 0) {
      onClear();
      return;
    }
    const parsed = duration ? parseDurationInput(next) : parseRepsInput(next);
    if (parsed !== null) {
      onLog(parsed);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
    >
      <Text variant="mono" color="textTertiary" style={{ width: 32 }}>
        {String(index).padStart(2, '0')}
      </Text>

      <TextInput
        accessibilityLabel={`${block.name}, ${duration ? 'time' : 'repetitions'} for rep ${index}`}
        keyboardType={duration ? 'numbers-and-punctuation' : 'number-pad'}
        onChangeText={commit}
        placeholder={duration ? 'MM:SS' : '0'}
        placeholderTextColor={theme.colors.textDisabled}
        selectionColor={theme.colors.accent}
        style={{
          ...theme.typography.metricMd,
          color: theme.colors.textPrimary,
          flex: 1,
          height: 48,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderWidth: theme.hairline.width,
          borderColor: complete ? theme.colors.accentBorder : theme.colors.border,
          backgroundColor: complete
            ? theme.colors.accentSurface
            : theme.colors.backgroundSunken,
        }}
        value={text}
      />

      <View style={{ width: 84, alignItems: 'flex-end' }}>
        {complete && verdict !== 'unknown' ? (
          <Text variant="labelSm" style={{ color: verdictColor(theme, verdict) }}>
            {VERDICT_LABEL[verdict]}
          </Text>
        ) : complete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear rep ${index}`}
            onPress={() => {
              setText('');
              onClear();
            }}
            hitSlop={8}
          >
            <Text variant="labelSm" color="textTertiary">
              CLEAR
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function BlockLogger({ block, session, results, onLog, onClear }: BlockLoggerProps) {
  const theme = useTheme();

  const distance = repDistance(block);
  const target =
    'target' in block && block.target && distance
      ? resolvePaceTarget(block.target, distance, results)
      : null;

  const duration = logsDuration(block);
  const total = expectedReps(block);
  const logged = entriesForBlock(session, block.id);
  const byIndex = new Map(logged.map((entry) => [entry.repIndex, entry]));

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
        <Text variant="monoSm" color="textTertiary">
          {`${logged.length}/${total}`}
        </Text>
      </View>

      {target ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="labelSm" color="textTertiary">
            {target.estimated ? 'Target (estimated)' : 'Target'}
          </Text>
          <Text variant="metricMd" color="accent">
            {formatDurationRange(target.lowSeconds, target.highSeconds)}
          </Text>
        </View>
      ) : null}

      {distance ? (
        <Text variant="monoSm" color="textTertiary">
          {formatDistance(distance)}
          {block.kind === 'ruck' ? ` @ ${block.loadPounds} LB` : ''}
        </Text>
      ) : null}

      <View>
        {Array.from({ length: total }, (_, index) => index + 1).map((repIndex) => (
          <RepRow
            key={repIndex}
            index={repIndex}
            block={block}
            entry={byIndex.get(repIndex)}
            target={target}
            duration={duration}
            onLog={(value) =>
              onLog({
                blockId: block.id,
                repIndex,
                ...(duration ? { durationSeconds: value } : { reps: value }),
                ...(distance ? { distanceMeters: distance } : {}),
              })
            }
            onClear={() => onClear(block.id, repIndex)}
          />
        ))}
      </View>
    </View>
  );
}
