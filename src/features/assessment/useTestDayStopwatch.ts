import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  elapsedSeconds,
  isTimerRunning,
  pauseTimer,
  startTimer,
} from '@/domain/training/session';
import type { TimerSegment } from '@/domain/training/types';

/**
 * The test-day stopwatch.
 *
 * Same discipline as the workout timer: elapsed time is derived from
 * timestamps, never accumulated from interval ticks, so a phone locked in a
 * pocket for nine minutes of a ruck still reads nine minutes. The interval
 * only repaints; it keeps no time of its own.
 */
export interface TestDayStopwatch {
  elapsed: number;
  running: boolean;
  /** True once the watch has ever been started for this event. */
  used: boolean;
  toggle: () => void;
  reset: () => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function useTestDayStopwatch(): TestDayStopwatch {
  const [segments, setSegments] = useState<readonly TimerSegment[]>([]);
  const [, setTick] = useState(0);

  const running = isTimerRunning(segments);

  useEffect(() => {
    if (!running) {
      return;
    }
    const handle = setInterval(() => setTick((value) => value + 1), 500);
    return () => clearInterval(handle);
  }, [running]);

  // Repaint immediately on returning to the foreground, so the athlete never
  // reads a stale split after unlocking their phone at the finish.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        setTick((value) => value + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const toggle = useCallback(() => {
    setSegments((current) =>
      isTimerRunning(current) ? pauseTimer(current, nowIso()) : startTimer(current, nowIso()),
    );
  }, []);

  const reset = useCallback(() => {
    setSegments([]);
  }, []);

  return {
    elapsed: elapsedSeconds(segments, nowIso()),
    running,
    used: segments.length > 0,
    toggle,
    reset,
  };
}
