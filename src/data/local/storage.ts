import AsyncStorage from '@react-native-async-storage/async-storage';

import { err, ok, type Result } from '@/domain/types';

/**
 * Thin persistence layer over AsyncStorage.
 *
 * Everything is wrapped in a Result: storage genuinely can fail (a full disk,
 * a corrupted value, a failed JSON parse) and a training app that crashes on
 * launch because one record went bad is worse than one that reports it.
 *
 * This is deliberately not an offline-first sync engine. It is durable local
 * storage so an athlete profile survives a restart. Supabase replaces the
 * repositories above it in M8; this layer stays as the local cache.
 */

/**
 * Bumped when the shape of any persisted record changes incompatibly.
 * Records written by a newer schema are ignored rather than misread, which
 * matters once a build can be downgraded through TestFlight.
 */
export const SCHEMA_VERSION = 1;

const KEY_PREFIX = 'phase1';

export const StorageKeys = {
  athleteProfile: `${KEY_PREFIX}:athlete_profile`,
  assessmentResults: `${KEY_PREFIX}:assessment_results`,
  readinessSnapshots: `${KEY_PREFIX}:readiness_snapshots`,
  workoutResults: `${KEY_PREFIX}:workout_results`,
  exerciseResults: `${KEY_PREFIX}:exercise_results`,
  /** The single in-progress session, if any. Cleared on completion. */
  activeSession: `${KEY_PREFIX}:active_session`,
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/** Every record is versioned so a migration has something to key off. */
interface Envelope<T> {
  version: number;
  data: T;
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof (value as { version: unknown }).version === 'number' &&
    'data' in value
  );
}

const STORAGE_ERROR = {
  code: 'unknown' as const,
  message: 'Could not read your saved data. Please try again.',
};

const WRITE_ERROR = {
  code: 'unknown' as const,
  message: 'Could not save your changes. Please try again.',
};

/**
 * Reads a persisted record.
 *
 * Returns null rather than an error when the key is absent, because "nothing
 * saved yet" is the normal state on first launch, not a failure. A value that
 * is present but unreadable is also treated as absent: a corrupt record should
 * not permanently brick the app, and the caller will simply write a fresh one.
 */
export async function readRecord<T>(key: StorageKey): Promise<Result<T | null>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      return ok(null);
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) {
      return ok(null);
    }
    if (parsed.version > SCHEMA_VERSION) {
      // Written by a newer build. Better to ignore than to misinterpret.
      return ok(null);
    }

    return ok(parsed.data as T);
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      // Corrupt JSON. Recoverable: treat as absent.
      return ok(null);
    }
    return err({ ...STORAGE_ERROR, cause });
  }
}

export async function writeRecord<T>(key: StorageKey, data: T): Promise<Result<void>> {
  try {
    const envelope: Envelope<T> = { version: SCHEMA_VERSION, data };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
    return ok(undefined);
  } catch (cause) {
    return err({ ...WRITE_ERROR, cause });
  }
}

/** Removes every record this app owns. Used by the developer reset action. */
export async function clearAllRecords(): Promise<Result<void>> {
  try {
    await AsyncStorage.multiRemove(Object.values(StorageKeys));
    return ok(undefined);
  } catch (cause) {
    return err({ ...WRITE_ERROR, cause });
  }
}
