import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import type { AssessmentEvent } from '@/domain/assessment/types';
import { parseDurationInput, parseRepsInput, toDurationInput } from '@/lib/parse';
import { useTheme } from '@/theme';

export interface AssessmentFieldProps {
  event: AssessmentEvent;
  /** Stored value in the event unit, or undefined when deferred. */
  value: number | undefined;
  onChange: (value: number | null) => void;
}

/**
 * One baseline entry, with an explicit way to skip it.
 *
 * Deferring is a first-class choice rather than a blank field: an athlete who
 * has never swum 500m should not have to invent a number, and the readiness
 * engine handles the gap honestly through coverage.
 */
export function AssessmentField({ event, value, onChange }: AssessmentFieldProps) {
  const theme = useTheme();
  const isDuration = event.unit === 'seconds';

  const [text, setText] = useState(() => {
    if (value === undefined) {
      return '';
    }
    return isDuration ? toDurationInput(value) : String(value);
  });
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (next: string) => {
      setText(next);
      setTouched(true);

      if (next.trim().length === 0) {
        onChange(null);
        return;
      }

      const parsed = isDuration ? parseDurationInput(next) : parseRepsInput(next);
      // Null while the athlete is mid-type is expected, not an error state.
      onChange(parsed);
    },
    [isDuration, onChange],
  );

  const deferred = text.trim().length === 0;
  const invalid = touched && !deferred && value === undefined;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <TextField
        label={event.name}
        value={text}
        onChangeText={handleChange}
        placeholder={isDuration ? 'MM:SS' : '0'}
        suffix={isDuration ? undefined : 'reps'}
        keyboardType={isDuration ? 'numbers-and-punctuation' : 'number-pad'}
        helper={invalid ? undefined : event.protocol}
        error={
          invalid
            ? isDuration
              ? 'Enter a time as minutes and seconds, for example 9:28.'
              : 'Enter a whole number of repetitions.'
            : undefined
        }
        testID={`baseline-${event.id}`}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Test ${event.name} later`}
        accessibilityState={{ selected: deferred }}
        onPress={() => {
          setText('');
          setTouched(false);
          onChange(null);
        }}
        style={{
          alignSelf: 'flex-start',
          minHeight: theme.minTouchTarget,
          justifyContent: 'center',
          paddingRight: theme.spacing.lg,
        }}
      >
        <Text variant="labelSm" color={deferred ? 'accent' : 'textTertiary'}>
          {deferred ? 'Testing later' : 'Test later'}
        </Text>
      </Pressable>
    </View>
  );
}
