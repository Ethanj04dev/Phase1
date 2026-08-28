import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import {
  ASSESSMENT_EVENTS,
  RUCK_ASSESSMENT_LOAD_POUNDS,
  type AssessmentEvent,
  type AssessmentEventId,
} from '@/domain/assessment/types';
import { AssessmentField } from '@/features/assessment/AssessmentField';
import { formatEventValue } from '@/features/assessment/display';
import { useLogAssessment } from '@/features/assessment/useLogAssessment';
import { useTestDayStopwatch } from '@/features/assessment/useTestDayStopwatch';
import { formatDuration } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * Test day, treated as the event it is.
 *
 * Logging a full battery used to be a form. This is a flow: one event at a
 * time, protocol on screen where the athlete can re-read it between efforts,
 * a stopwatch for the timed events, and nothing saved until the end so a
 * test day is one atomic record, exactly like the baseline.
 *
 * The stopwatch derives elapsed time from timestamps, so a locked phone
 * during a 41-minute ruck costs nothing. Skipping an event is a first-class
 * choice: an athlete without pool access today should not have to invent a
 * swim time, and coverage handles the gap honestly.
 */

type EventValues = Partial<Record<AssessmentEventId, number>>;

function StopwatchCard({
  event,
  onCaptured,
}: {
  event: AssessmentEvent;
  onCaptured: (seconds: number) => void;
}) {
  const theme = useTheme();
  const watch = useTestDayStopwatch();

  return (
    <Card style={{ gap: theme.spacing.md, alignItems: 'center' }}>
      <Text
        variant="display"
        style={{ fontVariant: ['tabular-nums'] }}
        accessibilityLabel={`Stopwatch at ${formatDuration(Math.round(watch.elapsed))}`}
      >
        {formatDuration(Math.round(watch.elapsed))}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Button
          label={watch.running ? 'Stop' : watch.used ? 'Resume' : 'Start'}
          variant={watch.running ? 'secondary' : 'primary'}
          fullWidth={false}
          size="lg"
          onPress={() => {
            const wasRunning = watch.running;
            watch.toggle();
            if (wasRunning) {
              onCaptured(Math.round(watch.elapsed));
            }
          }}
          accessibilityHint={
            watch.running
              ? `Stops the watch and records the time for ${event.name}`
              : `Starts timing ${event.name}`
          }
        />
        {watch.used && !watch.running ? (
          <Button label="Reset" variant="ghost" fullWidth={false} size="lg" onPress={watch.reset} />
        ) : null}
      </View>
      <Text variant="caption" color="textTertiary" align="center">
        Stopping fills the field below. The time stays editable — a wristwatch split
        beats a fumbled phone.
      </Text>
    </Card>
  );
}

export default function TestDayScreen() {
  const theme = useTheme();
  const { log, submitting, error } = useLogAssessment();

  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<EventValues>({});
  const [skipped, setSkipped] = useState<readonly AssessmentEventId[]>([]);
  /** Remounts the entry field when the stopwatch writes into it. */
  const [captureKey, setCaptureKey] = useState(0);
  const [finished, setFinished] = useState(false);

  const event = ASSESSMENT_EVENTS[index];
  const total = ASSESSMENT_EVENTS.length;
  const recordedCount = Object.keys(values).length;

  const advance = useCallback(() => {
    setCaptureKey(0);
    if (index + 1 >= total) {
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
  }, [index, total]);

  const handleSave = async () => {
    const entries = ASSESSMENT_EVENTS.flatMap((item) => {
      const value = values[item.id];
      return value === undefined ? [] : [{ eventId: item.id, value }];
    });
    const outcome = await log(entries);
    if (outcome) {
      goBack('/progress');
    }
  };

  if (finished || !event) {
    return (
      <Screen
        scroll
        testID="test-day-summary"
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.xl,
        }}
        footer={
          recordedCount > 0 ? (
            <Button
              label={`Save ${recordedCount} result${recordedCount === 1 ? '' : 's'}`}
              size="lg"
              loading={submitting}
              onPress={handleSave}
              testID="save-test-day"
            />
          ) : (
            <Button label="Done" size="lg" onPress={() => goBack('/progress')} />
          )
        }
      >
        <Text variant="title" accessibilityRole="header">
          Test day complete
        </Text>
        {recordedCount === 0 ? (
          <Text variant="body" color="textSecondary">
            Nothing recorded. That is fine — come back when the day suits testing.
          </Text>
        ) : (
          <Card padded={false}>
            {ASSESSMENT_EVENTS.map((item, itemIndex) => {
              const value = values[item.id];
              return (
                <View key={item.id}>
                  {itemIndex > 0 ? <Divider /> : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.lg,
                    }}
                  >
                    <Text variant="body" style={{ flex: 1 }}>
                      {item.name}
                    </Text>
                    {value === undefined ? (
                      <Text variant="bodySm" color="textTertiary">
                        Skipped
                      </Text>
                    ) : (
                      <Text variant="metricMd">{formatEventValue(item, value)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        {/* Nothing was written yet: the whole day saves as one atomic batch. */}
        <Text variant="caption" color="textTertiary">
          Nothing is saved until you save. The battery records as one sitting, and your
          readiness updates immediately after.
        </Text>
        {error ? (
          <Text variant="bodySm" color="statusOffTarget">
            {error}
          </Text>
        ) : null}
      </Screen>
    );
  }

  const value = values[event.id];
  const isTimed = event.unit === 'seconds';

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="test-day"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={value === undefined ? 'Skip this event' : 'Record and continue'}
            size="lg"
            variant={value === undefined ? 'secondary' : 'primary'}
            onPress={() => {
              if (value === undefined) {
                setSkipped((current) => [...current, event.id]);
              }
              advance();
            }}
            testID="test-day-advance"
          />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="bodySm" color="textTertiary">
          {`Event ${index + 1} of ${total}`}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {event.name}
        </Text>
      </View>

      {/* The protocol, where it can be re-read between efforts. Consistent
          conditions are what keep a retest comparable with the last one. */}
      <Card style={{ gap: theme.spacing.xs }}>
        <Text variant="bodySm" color="textTertiary">
          Protocol
        </Text>
        <Text variant="body" color="textSecondary">
          {event.protocol}
        </Text>
        {event.id === 'ruck_3_mile' ? (
          <Text variant="bodySm" color="textTertiary">
            {`Standard load: ${RUCK_ASSESSMENT_LOAD_POUNDS} lb.`}
          </Text>
        ) : null}
      </Card>

      {isTimed ? (
        <StopwatchCard
          // Keyed by event so each timed event gets a fresh watch. Without
          // this, React reuses the component across events and the 1.5 mile
          // inherits the 1 mile's elapsed time.
          key={event.id}
          event={event}
          onCaptured={(seconds) => {
            setValues((current) => ({ ...current, [event.id]: seconds }));
            setCaptureKey((key) => key + 1);
          }}
        />
      ) : null}

      <AssessmentField
        key={`${event.id}-${captureKey}`}
        event={event}
        value={value}
        showProtocol={false}
        deferrable={false}
        onChange={(next) => {
          setValues((current) => {
            const updated = { ...current };
            if (next === null) {
              delete updated[event.id];
            } else {
              updated[event.id] = next;
            }
            return updated;
          });
        }}
      />

      {skipped.length > 0 ? (
        <Text variant="caption" color="textTertiary">
          {`Skipped so far: ${skipped.length}. Skipping is honest — coverage handles the gap.`}
        </Text>
      ) : null}
    </Screen>
  );
}
