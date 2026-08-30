import { err, type DomainError, type Result } from '@/domain/types';

import type { VerificationRepository } from './types';

/**
 * The verification repository for contexts with no backend: local storage
 * and the demo mocks. Every method refuses with the same honest message.
 *
 * This is deliberate, not a stub-in-waiting: a verified performance cannot
 * exist without the server issuing challenges and stamping clocks. An
 * offline implementation that pretended otherwise would counterfeit the one
 * thing the product promises.
 */

const UNAVAILABLE: DomainError = {
  code: 'unauthorized',
  message: 'Verified assessments need an account. Sign in to start one.',
};

function refuse<T>(): Promise<Result<T>> {
  return Promise.resolve(err(UNAVAILABLE));
}

export const verificationUnavailable: VerificationRepository = {
  getActiveSession: () => refuse(),
  createSession: () => refuse(),
  commitEvidence: () => refuse(),
  uploadEvidence: () => refuse(),
  openEvent: () => refuse(),
  closeEvent: () => refuse(),
  submit: () => refuse(),
  abandon: () => refuse(),
  getClaims: () => refuse(),
  isReviewer: () => refuse(),
  listReviewQueue: () => refuse(),
  getReviewDetail: () => refuse(),
  getEvidenceUrl: () => refuse(),
  reviewEvent: () => refuse(),
  finalize: () => refuse(),
};
