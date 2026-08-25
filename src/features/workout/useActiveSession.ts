import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useRepositories } from '@/data/repositoryContext';
import type { AssessmentResult } from '@/domain/assessment/types';
import {
  elapsedSeconds,
  isTimerRunning,
  pauseTimer,
  removeEntry,
  startTimer,
  upsertEntry,
} from '@/domain/training/session';
import type {
  ActiveEntry,
  ActiveSession,
  ResolvedWorkoutDay,
  WorkoutResult,
} from '@/domain/training/types';

export interface ActiveWorkoutState {
  session: ActiveSession | null;
  day: ResolvedWorkoutDay | null;
  results: readonly AssessmentResult[];
  loading: boolean;
  error: string | null;
  saving: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Elapsed seconds, re-rendered once a second while the clock runs.
 *
 * The interval only drives repaints. The value itself is always recomputed
 * from timestamps, so a session that was backgrounded for twenty minutes shows
 * twenty more minutes the instant it returns rather than resuming from
 * wherever the ticks stopped.
 */
export function useElapsed(session: ActiveSession | null): number {
  const [, setTick] = useState(0);
  const running = session ? isTimerRunning(session.segments) : false;

  useEffect(() => {
    if (!running) {
      return;
    }
    const handle = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(handle);
  }, [running]);

  // Repaint immediately on returning to the foreground, so the athlete never
  // sees a stale number for up to a second after unlocking their phone.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        setTick((value) => value + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  return session ? elapsedSeconds(session.segments, nowIso()) : 0;
}

/**
 * Owns the in-progress workout.
 *
 * Every mutation persists immediately. The athlete is outdoors and mid-effort;
 * the app being evicted must cost them nothing.
 */
export function useActiveSession(dayId: string | undefined) {
  const { athlete, assessment, training, workout } = useRepositories();
  const [state, setState] = useState<ActiveWorkoutState>({
    session: null,
    day: null,
    results: [],
    loading: true,
    error: null,
    saving: false,
  });

  // Guards against a write landing after the screen has gone.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = useCallback(
    async (next: ActiveSession) => {
      setState((current) => ({ ...current, session: next }));
      const saved = await workout.saveActive(next);
      if (!saved.ok && mounted.current) {
        setState((current) => ({ ...current, error: saved.error.message }));
      }
    },
    [workout],
  );

  const load = useCallback(async () => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok || !profileResult.value) {
      if (mounted.current) {
        setState((current) => ({
          ...current,
          loading: false,
          error: 'We could not find your athlete profile.',
        }));
      }
      return;
    }
    const profile = profileResult.value;

    const [existing, resultsOutcome] = await Promise.all([
      workout.getActive(profile.id),
      assessment.listResults(profile.id),
    ]);

    // Resuming wins over the route parameter: an unfinished session must never
    // be silently replaced by starting a new one.
    const resumed = existing.ok ? existing.value : null;
    const targetDayId = resumed?.workoutDayId ?? dayId;

    if (!targetDayId) {
      if (mounted.current) {
        setState((current) => ({ ...current, loading: false, error: 'No session to open.' }));
      }
      return;
    }

    const dayResult = await training.getDay(profile.id, targetDayId);
    if (!dayResult.ok || !dayResult.value) {
      if (mounted.current) {
        setState((current) => ({
          ...current,
          loading: false,
          error: 'We could not find that session.',
        }));
      }
      return;
    }

    const session: ActiveSession = resumed ?? {
      id: Crypto.randomUUID(),
      athleteId: profile.id,
      workoutDayId: targetDayId,
      startedAt: nowIso(),
      segments: startTimer([], nowIso()),
      entries: [],
      rpe: null,
      notes: '',
    };

    if (!resumed) {
      await workout.saveActive(session);
    }

    if (mounted.current) {
      setState({
        session,
        day: dayResult.value,
        results: resultsOutcome.ok ? resultsOutcome.value : [],
        loading: false,
        error: null,
        saving: false,
      });
    }
  }, [assessment, athlete, dayId, training, workout]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTimer = useCallback(() => {
    setState((current) => {
      if (!current.session) {
        return current;
      }
      const running = isTimerRunning(current.session.segments);
      const segments = running
        ? pauseTimer(current.session.segments, nowIso())
        : startTimer(current.session.segments, nowIso());
      const next = { ...current.session, segments };
      void persist(next);
      return { ...current, session: next };
    });
  }, [persist]);

  const logEntry = useCallback(
    (entry: Omit<ActiveEntry, 'recordedAt'>) => {
      setState((current) => {
        if (!current.session) {
          return current;
        }
        const next: ActiveSession = {
          ...current.session,
          entries: upsertEntry(current.session.entries, {
            ...entry,
            recordedAt: nowIso(),
          }),
        };
        void persist(next);
        // Confirmation for a rep logged mid-effort, when the athlete may not
        // be looking at the screen.
        if (Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        return { ...current, session: next };
      });
    },
    [persist],
  );

  const clearEntry = useCallback(
    (blockId: string, repIndex: number) => {
      setState((current) => {
        if (!current.session) {
          return current;
        }
        const next: ActiveSession = {
          ...current.session,
          entries: removeEntry(current.session.entries, blockId, repIndex),
        };
        void persist(next);
        return { ...current, session: next };
      });
    },
    [persist],
  );

  const setRpe = useCallback(
    (rpe: number) => {
      setState((current) => {
        if (!current.session) {
          return current;
        }
        const next = { ...current.session, rpe };
        void persist(next);
        return { ...current, session: next };
      });
    },
    [persist],
  );

  const setNotes = useCallback(
    (notes: string) => {
      setState((current) => {
        if (!current.session) {
          return current;
        }
        const next = { ...current.session, notes };
        void persist(next);
        return { ...current, session: next };
      });
    },
    [persist],
  );

  const finish = useCallback(async (): Promise<WorkoutResult | null> => {
    const session = state.session;
    if (!session) {
      return null;
    }

    setState((current) => ({ ...current, saving: true, error: null }));

    // Stop the clock before reading it, so the recorded duration matches what
    // the athlete last saw rather than creeping while they fill in notes.
    const stopped: ActiveSession = {
      ...session,
      segments: pauseTimer(session.segments, nowIso()),
    };
    const duration = elapsedSeconds(stopped.segments, nowIso());

    const completed = await workout.complete(stopped, duration);
    if (!mounted.current) {
      return completed.ok ? completed.value : null;
    }

    if (!completed.ok) {
      setState((current) => ({ ...current, saving: false, error: completed.error.message }));
      return null;
    }

    setState((current) => ({ ...current, saving: false, session: null }));
    return completed.value;
  }, [state.session, workout]);

  const discard = useCallback(async () => {
    const session = state.session;
    if (!session) {
      return;
    }
    await workout.discardActive(session.athleteId);
    if (mounted.current) {
      setState((current) => ({ ...current, session: null }));
    }
  }, [state.session, workout]);

  return { ...state, toggleTimer, logEntry, clearEntry, setRpe, setNotes, finish, discard };
}
