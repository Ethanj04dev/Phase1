import type { GoalId } from '@/domain/goals/types';
import type { IsoDateTime, Uuid } from '@/domain/types';

import type { StateCode } from './states';

/**
 * The candidate's competitive identity.
 *
 * Deliberately a separate concept from AthleteProfile. The athlete profile is
 * training configuration — experience levels, track, days per week. The
 * candidate profile is who this person is in the community: their handle,
 * their pipeline, whether they appear on leaderboards. Performance, rating and
 * ranking stay separate again; folding everything into one object is how a
 * privacy rule gets missed.
 *
 * Everything here except id/userId is safe to show the candidate themselves.
 * What other people may see is a strictly smaller set, defined by
 * PUBLIC_CANDIDATE_FIELDS below and enforced server-side by a view — the
 * client never gets the chance to over-share.
 */

export type CandidateVisibility = 'public' | 'private';

export interface CandidateProfile {
  id: Uuid;
  userId: Uuid;
  /** Canonical lowercase handle. Unique across the product. */
  handle: string;
  /** The candidate's own casing of the same handle. What everyone sees. */
  displayHandle: string;
  /** Optional. Real names are never required. */
  displayName: string | null;
  /**
   * The pipeline this candidate is preparing for. Changing it later moves the
   * same account — history is kept, and anything scored against a pipeline is
   * recomputed rather than duplicated.
   */
  pipelineId: GoalId;
  /** Self-declared, optional. The finest location the product records. */
  stateCode: StateCode | null;
  /**
   * Private candidates track everything for themselves but never appear on
   * leaderboards or in public profile lookups.
   */
  visibility: CandidateVisibility;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * The only candidate fields other users may ever see, mirrored by the
 * `public_candidate_profiles` view. Not exported for UI convenience — exported
 * so a test can pin the list and fail loudly when someone widens it.
 *
 * Never in this list, by decision: date of birth, email, exact location,
 * recruiter or application information, evidence media.
 */
export const PUBLIC_CANDIDATE_FIELDS = [
  'id',
  'handle',
  'displayHandle',
  'displayName',
  'pipelineId',
  'stateCode',
  'createdAt',
] as const satisfies readonly (keyof CandidateProfile)[];

export const BIO_MAX_LENGTH = 160;

export const VISIBILITY_LABELS: Record<CandidateVisibility, string> = {
  public: 'Public',
  private: 'Private',
};
