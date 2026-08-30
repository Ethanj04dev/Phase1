import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { AthleteProfile } from '@/domain/athlete/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

import { loadPipelineSnapshot, type PipelineSnapshot } from './pipelineSnapshot';

export interface PipelineView extends PipelineSnapshot {
  profile: AthleteProfile;
}

const NO_PROFILE = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

export function usePipeline(): AsyncResource<PipelineView> {
  const { athlete, assessment, proficiency, training } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<PipelineView>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE);
    }

    const snapshot = await loadPipelineSnapshot({ assessment, proficiency, training }, profile);
    if (!snapshot.ok) {
      return snapshot;
    }

    return ok({ profile, ...snapshot.value });
  }, [assessment, athlete, proficiency, training]);

  return useAsyncResource(fetcher);
}
