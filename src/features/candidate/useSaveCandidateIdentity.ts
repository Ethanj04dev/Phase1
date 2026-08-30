import { useCallback, useState } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import { validateHandle } from '@/domain/candidate/handle';
import type { StateCode } from '@/domain/candidate/states';
import type { CandidateProfile, CandidateVisibility } from '@/domain/candidate/types';

export interface IdentityDraft {
  handleInput: string;
  displayName: string;
  stateCode: StateCode | null;
  visibility: CandidateVisibility;
  bio: string;
}

/**
 * Creates or updates the candidate identity from one draft shape.
 *
 * Create and update share a code path on purpose: the identity screen serves
 * both the athlete claiming a handle for the first time and the candidate
 * changing their state, and two save paths would drift. The handle is
 * re-validated here rather than trusted from the field, and a conflict from
 * the repository (the handle was taken in the meantime) surfaces as the error
 * message, not as a crash.
 */
export function useSaveCandidateIdentity() {
  const { athlete, candidate } = useRepositories();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (existing: CandidateProfile | null, draft: IdentityDraft): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const validated = validateHandle(draft.handleInput);
        if (!validated.ok) {
          setError(validated.message);
          return false;
        }

        const shared = {
          handle: validated.handle,
          displayHandle: validated.displayHandle,
          displayName: draft.displayName.trim() === '' ? null : draft.displayName.trim(),
          stateCode: draft.stateCode,
          visibility: draft.visibility,
          bio: draft.bio.trim() === '' ? null : draft.bio.trim(),
        };

        if (existing) {
          const updated = await candidate.update(existing.id, shared);
          if (!updated.ok) {
            setError(updated.error.message);
            return false;
          }
          return true;
        }

        // First claim. The pipeline comes from the training profile so the
        // two records agree from the moment the identity exists; an athlete
        // with no profile at all cannot reach this screen outside onboarding.
        const profile = await athlete.getCurrentProfile();
        const pipelineId =
          profile.ok && profile.value ? profile.value.goalId : ('general_selection' as const);

        const created = await candidate.create({
          ...shared,
          pipelineId,
          avatarUrl: null,
        });
        if (!created.ok) {
          setError(created.error.message);
          return false;
        }
        return true;
      } finally {
        setSaving(false);
      }
    },
    [athlete, candidate],
  );

  return { save, saving, error };
}
