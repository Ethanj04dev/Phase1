import * as FileSystem from 'expo-file-system/legacy';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { haversineMeters } from '@/domain/runEngine/geo';
import type { RunSample, RunTrace, RunTraceEvent } from '@/domain/runEngine/types';
import { formatDistance, formatDuration } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * In-app GPS capture for distance events.
 *
 * Foreground-only by design for this milestone: the screen stays awake, the
 * app stays open, and going to the background is recorded as a trace event
 * the engine treats as a continuity finding — stated to the candidate up
 * front rather than discovered in review. Elapsed time derives from
 * timestamps, never accumulated ticks.
 *
 * The raw trace is the evidence. Every sample is kept exactly as the
 * platform reported it; the live distance shown here is a courtesy estimate
 * and the engine's own measurement is what counts.
 */

export interface RunCaptureResult {
  /** Local JSON file holding the raw trace — uploaded as evidence. */
  fileUri: string;
  trace: RunTrace;
  durationSeconds: number;
}

export interface RunTrackerProps {
  challengeCode: string;
  requiredDistanceMeters: number;
  onCaptured: (result: RunCaptureResult) => void;
  disabled?: boolean;
}

export function RunTracker({
  challengeCode,
  requiredDistanceMeters,
  onCaptured,
  disabled = false,
}: RunTrackerProps) {
  const theme = useTheme();
  useKeepAwake();

  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [tracking, setTracking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [liveDistance, setLiveDistance] = useState(0);
  const [liveElapsed, setLiveElapsed] = useState(0);

  const samplesRef = useRef<RunSample[]>([]);
  const eventsRef = useRef<RunTraceEvent[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (!startedAtRef.current) {
        return;
      }
      eventsRef.current.push({
        t: Date.now(),
        type: state === 'active' ? 'app_foreground' : 'app_background',
      });
    });
    return () => {
      appStateSubscription.remove();
      subscriptionRef.current?.remove();
      if (tickRef.current) {
        clearInterval(tickRef.current);
      }
    };
  }, []);

  if (Platform.OS === 'web') {
    return (
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="headline">GPS capture needs the phone</Text>
        <Text variant="bodySm" color="textSecondary">
          Run evidence is a GPS trace recorded through the app. Open Zero Phase in Expo Go
          to record this event.
        </Text>
      </Card>
    );
  }

  if (!permission?.granted) {
    return (
      <Card style={{ gap: theme.spacing.lg }}>
        <Text variant="bodySm" color="textSecondary">
          The run is verified from a GPS trace, so location access is required while you
          run. Location is recorded only during the event and only as evidence for this
          assessment.
        </Text>
        <Button
          label="Allow location"
          onPress={() => void requestPermission()}
          testID="grant-location"
        />
      </Card>
    );
  }

  const start = async () => {
    setFailure(null);
    samplesRef.current = [];
    eventsRef.current = [{ t: Date.now(), type: 'tracking_start' }];
    startedAtRef.current = Date.now();
    setLiveDistance(0);
    setLiveElapsed(0);

    try {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (position) => {
          const sample: RunSample = {
            t: position.timestamp,
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            acc: position.coords.accuracy ?? null,
            alt: position.coords.altitude ?? null,
            spd: position.coords.speed ?? null,
          };
          const previous = samplesRef.current[samplesRef.current.length - 1];
          samplesRef.current.push(sample);
          if (previous && sample.t > previous.t) {
            setLiveDistance(
              (current) =>
                current +
                haversineMeters(previous.lat, previous.lon, sample.lat, sample.lon),
            );
          }
        },
      );
      // Display clock, derived from timestamps each tick — never accumulated.
      tickRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setLiveElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
        }
      }, 1000);
      setTracking(true);
    } catch {
      setFailure('GPS could not start. Check location settings and try again.');
    }
  };

  const stop = async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    eventsRef.current.push({ t: Date.now(), type: 'tracking_stop' });
    setTracking(false);

    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    const trace: RunTrace = {
      formatVersion: 1,
      samples: samplesRef.current,
      events: eventsRef.current,
    };
    if (trace.samples.length === 0 || !startedAt) {
      setFailure('No GPS samples were recorded. Try again outdoors with a clear sky view.');
      return;
    }
    try {
      const fileUri = `${FileSystem.cacheDirectory}run-trace-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(trace));
      onCaptured({
        fileUri,
        trace,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
    } catch {
      setFailure('The trace could not be saved. Check storage space and try again.');
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="labelSm" color="accent">
          {challengeCode}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text variant="labelSm" color="textTertiary">
              ELAPSED
            </Text>
            <Text variant="display">{formatDuration(liveElapsed)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="labelSm" color="textTertiary">
              DISTANCE (LIVE)
            </Text>
            <Text variant="display">{formatDistance(liveDistance)}</Text>
          </View>
        </View>
        <Text variant="caption" color="textTertiary">
          {`Required: ${formatDistance(requiredDistanceMeters)} — run a little past it; your official time is read at exactly the required distance. Keep the app open and the screen on for the whole run. Distance and time are computed from the trace, not from this display.`}
        </Text>
      </Card>

      {failure ? (
        <Text variant="caption" color="statusOffTarget">
          {failure}
        </Text>
      ) : null}

      {tracking ? (
        <Button label="Finish run" variant="destructive" onPress={() => void stop()} testID="stop-run" />
      ) : (
        <Button label="Start run" disabled={disabled} onPress={() => void start()} testID="start-run" />
      )}
    </View>
  );
}
