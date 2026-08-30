import { useCallback, useState } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { AssessmentEventId } from '@/domain/assessment/types';
import type { ReviewDetail, ReviewQueueItem } from '@/data/repositories/types';
import type { VerificationVerdict } from '@/domain/verification/types';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

/**
 * Ground-truth console data. Reviewer-only, enforced server-side; these
 * hooks just surface the refusal politely for anyone else.
 *
 * This console is deliberately named for what it is now: the ground-truth
 * and QA tool. It holds interim authority while automated engines run in
 * shadow, and every verdict recorded here doubles as a labeled sample for
 * validating them. It is not the product's permanent verifier.
 */

const NOT_A_REVIEWER = {
  code: 'unauthorized' as const,
  message: 'Your account does not have review access.',
};

export function useReviewQueue(): AsyncResource<readonly ReviewQueueItem[]> {
  const { verification } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<readonly ReviewQueueItem[]>> => {
    const reviewer = await verification.isReviewer();
    if (!reviewer.ok) {
      return reviewer;
    }
    if (!reviewer.value) {
      return err(NOT_A_REVIEWER);
    }
    return verification.listReviewQueue();
  }, [verification]);

  return useAsyncResource(fetcher);
}

export function useReviewDetail(attemptId: string): AsyncResource<ReviewDetail> {
  const { verification } = useRepositories();

  const fetcher = useCallback(
    () => verification.getReviewDetail(attemptId),
    [attemptId, verification],
  );

  return useAsyncResource(fetcher);
}

export function useReviewActions(attemptId: string) {
  const { verification } = useRepositories();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewEvent = useCallback(
    async (
      eventId: AssessmentEventId,
      verdict: VerificationVerdict,
      acceptedValue: number | null,
      reasonCode: string | null,
      reasonText: string | null,
    ): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const saved = await verification.reviewEvent(
          attemptId,
          eventId,
          verdict,
          acceptedValue,
          reasonCode,
          reasonText,
        );
        if (!saved.ok) {
          setError(saved.error.message);
          return false;
        }
        return true;
      } finally {
        setBusy(false);
      }
    },
    [attemptId, verification],
  );

  const finalize = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await verification.finalize(attemptId);
      if (!outcome.ok) {
        setError(outcome.error.message);
        return null;
      }
      return outcome.value;
    } finally {
      setBusy(false);
    }
  }, [attemptId, verification]);

  const openEvidence = useCallback(
    async (storagePath: string): Promise<Result<string>> => {
      const url = await verification.getEvidenceUrl(storagePath);
      return url.ok ? ok(url.value) : url;
    },
    [verification],
  );

  return { reviewEvent, finalize, openEvidence, busy, error };
}
