import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  friendlyMessage,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/data/supabase/client';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'disabled';

interface AuthContextValue {
  /**
   * `disabled` means no backend is configured, so the app runs entirely on
   * local storage and never asks anyone to sign in.
   */
  status: AuthStatus;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<SignUpOutcome>;
  signOut: () => Promise<void>;
}

export interface SignUpOutcome {
  error: string | null;
  /**
   * True when the account was created but no session came back, which is what
   * Supabase does when the project requires email confirmation. The caller
   * must tell the athlete to go and confirm rather than navigating onward,
   * because there is nothing to navigate into.
   */
  needsEmailConfirmation: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MIN_PASSWORD_LENGTH = 8;

/**
 * Owns the auth session.
 *
 * When Supabase is not configured this reports `disabled` and every method is
 * a no-op, which is what keeps the app fully usable on local storage alone.
 * That is not a stub: an athlete with no account still has a working product.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? 'loading' : 'disabled',
  );

  useEffect(() => {
    if (!client) {
      return;
    }

    let cancelled = false;

    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setStatus(data.session ? 'signed_in' : 'signed_out');
    });

    // Covers token refresh and sign-out from another screen, so the app never
    // holds a session the server has already invalidated.
    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed_in' : 'signed_out');
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!client) return 'Accounts are not available in this build.';

      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return error ? friendlyMessage('We could not sign you in.', error) : null;
    },
    [client],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpOutcome> => {
      if (!client) {
        return {
          error: 'Accounts are not available in this build.',
          needsEmailConfirmation: false,
        };
      }
      // Checked here as well as server-side so the athlete finds out before a
      // round trip, and with wording we control.
      if (password.length < MIN_PASSWORD_LENGTH) {
        return {
          error: `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`,
          needsEmailConfirmation: false,
        };
      }

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        return {
          error: friendlyMessage('We could not create your account.', error),
          needsEmailConfirmation: false,
        };
      }

      // A project with email confirmation switched on creates the user but
      // withholds the session until they click the link. Treating that as
      // success and navigating on would drop the athlete back at this screen
      // with no explanation.
      return { error: null, needsEmailConfirmation: data.session === null };
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  const value = useMemo(
    () => ({ status, session, signIn, signUp, signOut }),
    [session, signIn, signOut, signUp, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
