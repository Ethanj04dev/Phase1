import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client.
 *
 * Configuration comes from EXPO_PUBLIC_ environment variables, which are
 * inlined into the bundle at build time. That is correct for the publishable
 * anon key -- it is designed to be public, and row-level security is what
 * actually protects the data.
 *
 * The service-role key must never appear here, in .env, or anywhere else in
 * this app. It bypasses RLS entirely.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Storage is unavailable while Expo prerenders web routes in Node: AsyncStorage
 * reaches for `window.localStorage` there and `window` does not exist.
 */
function storageAvailable(): boolean {
  return Platform.OS !== 'web' || typeof window !== 'undefined';
}

/**
 * Session storage that tolerates having no storage at all.
 *
 * Supabase reads the persisted session the moment the auth client is created,
 * which during a web prerender happens inside Node. Without this guard that
 * read throws ReferenceError and takes the entire web build down on boot.
 *
 * Returning null during prerender is correct rather than merely safe: there is
 * no signed-in user on a server that has never met the athlete, so "no stored
 * session" is the honest answer. The real session loads on the client.
 */
const sessionStorage = {
  getItem: (key: string): Promise<string | null> =>
    storageAvailable() ? AsyncStorage.getItem(key) : Promise.resolve(null),
  setItem: (key: string, value: string): Promise<void> =>
    storageAvailable() ? AsyncStorage.setItem(key, value) : Promise.resolve(),
  removeItem: (key: string): Promise<void> =>
    storageAvailable() ? AsyncStorage.removeItem(key) : Promise.resolve(),
};

/**
 * Whether a backend is configured at all.
 *
 * The app runs on local storage until it is. That keeps development working
 * without credentials and means a missing environment variable degrades to
 * offline-only rather than to a crash on launch.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!url || !anonKey) {
    return null;
  }
  if (client) {
    return client;
  }

  client = createClient(url, anonKey, {
    auth: {
      storage: sessionStorage,
      // The session must survive the app being closed; an athlete signing in
      // every launch is a broken product.
      persistSession: true,
      autoRefreshToken: true,
      // React Native has no URL to parse a session out of. Leaving this on
      // makes the client wait for a redirect that never arrives.
      detectSessionInUrl: false,
    },
  });

  return client;
}

/**
 * Turns a Supabase error into something safe to show an athlete.
 *
 * Raw PostgREST messages leak column names, constraint names and policy
 * details. None of that helps the user and some of it helps an attacker.
 */
export function friendlyMessage(fallback: string, cause?: unknown): string {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof (cause as { message: unknown }).message === 'string'
  ) {
    const message = (cause as { message: string }).message;
    // Auth messages are written for end users and are safe to pass through.
    if (/invalid login credentials/i.test(message)) {
      return 'That email or password is not right.';
    }
    if (/user already registered/i.test(message)) {
      return 'An account already exists for that email.';
    }
    if (/email/i.test(message) && /valid/i.test(message)) {
      return 'Enter a valid email address.';
    }
    if (/password/i.test(message) && /least/i.test(message)) {
      return 'Passwords must be at least 8 characters.';
    }
    if (/network|fetch/i.test(message)) {
      return 'Cannot reach the server. Check your connection.';
    }
  }
  return fallback;
}
