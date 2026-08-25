import { createContext, useContext, type ReactNode } from 'react';

import { mockRepositories } from './mock/mockRepositories';
import type { Repositories } from './repositories/types';

/**
 * Repository injection point. The app currently runs on mock repositories;
 * swapping in Supabase means changing the default passed here, and nothing
 * else. Tests override it per-render.
 */
const RepositoryContext = createContext<Repositories>(mockRepositories);

interface RepositoryProviderProps {
  repositories?: Repositories;
  children: ReactNode;
}

export function RepositoryProvider({
  repositories = mockRepositories,
  children,
}: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>
  );
}

export function useRepositories(): Repositories {
  return useContext(RepositoryContext);
}
