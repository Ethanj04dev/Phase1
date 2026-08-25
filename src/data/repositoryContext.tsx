import { createContext, useContext, type ReactNode } from 'react';

import { localRepositories } from './local/localRepositories';
import type { Repositories } from './repositories/types';

/**
 * Repository injection point.
 *
 * The app runs on locally persisted repositories. Swapping in Supabase means
 * changing the default passed here, and nothing else. Tests and stories
 * override it per-render with the mock implementation.
 */
const RepositoryContext = createContext<Repositories>(localRepositories);

interface RepositoryProviderProps {
  repositories?: Repositories;
  children: ReactNode;
}

export function RepositoryProvider({
  repositories = localRepositories,
  children,
}: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>
  );
}

export function useRepositories(): Repositories {
  return useContext(RepositoryContext);
}
