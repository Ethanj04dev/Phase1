import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { CandidateProfile } from '@/domain/candidate/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

/**
 * The signed-in (or local) candidate's own identity.
 *
 * Null is a real state, not an error: an athlete who onboarded before the
 * identity step existed, or whose migration hit a handle conflict, has
 * training data but no candidate profile yet. Screens show a claim path
 * rather than pretending.
 */
export function useCandidateProfile(): AsyncResource<CandidateProfile | null> {
  const { candidate } = useRepositories();

  const fetcher = useCallback(() => candidate.getMine(), [candidate]);

  return useAsyncResource(fetcher);
}
