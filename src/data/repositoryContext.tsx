import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

import { localRepositories } from './local/localRepositories';
import type { Repositories } from './repositories/types';
import { getSupabaseClient } from './supabase/client';
import { createSupabaseRepositories } from './supabase/supabaseRepositories';

/**
 * Repository injection point.
 *
 * The implementation is chosen from auth state rather than from a build flag:
 *
 * - No backend configured, or configured but signed out, means local storage.
 *   The app is fully usable either way; an athlete without an account still
 *   has a working product rather than a locked door.
 * - Signed in means Supabase.
 *
 * Screens depend on the interfaces only and never learn which is in play.
 * Tests override the whole set per-render.
 */
const RepositoryContext = createContext<Repositories>(localRepositories);

interface RepositoryProviderProps {
  repositories?: Repositories;
  children: ReactNode;
}

export function RepositoryProvider({ repositories, children }: RepositoryProviderProps) {
  const { status } = useAuth();

  const resolved = useMemo<Repositories>(() => {
    if (repositories) {
      return repositories;
    }
    if (status !== 'signed_in') {
      return localRepositories;
    }
    const client = getSupabaseClient();
    return client ? createSupabaseRepositories(client) : localRepositories;
  }, [repositories, status]);

  return <RepositoryContext.Provider value={resolved}>{children}</RepositoryContext.Provider>;
}

export function useRepositories(): Repositories {
  return useContext(RepositoryContext);
}
