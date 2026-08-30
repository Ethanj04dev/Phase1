/**
 * Every user-visible brand string lives here.
 *
 * Domain code must never reference "Zero Phase" — it deals in `athlete`,
 * `pipeline`, `assessment`, `rating`. That separation is what makes a
 * rebrand (this file has already survived one: Zero Phase → Zero Phase) a
 * config change rather than a refactor.
 *
 * Internal identifiers deliberately keep their old spellings where renaming
 * would destroy data or churn history for zero user-visible benefit: the
 * `phase1:` local-storage prefix, programme and day ids, and the repository
 * path. Identifiers are not branding.
 */
export const branding = {
  productName: 'ZERO PHASE',
  /** Split wordmark so the second word can carry the accent colour. */
  wordmark: {
    lead: 'ZERO',
    numeral: 'PHASE',
  },
  tagline: 'Train. Test. Prove it. Rank.',
  /** Short form used in dense headers and tab bars. */
  shortName: 'ZP',
  supportEmail: 'support@example.com',
} as const;

/**
 * The 0–1000 competitive rating's user-facing label.
 *
 * Deliberately generic: the proprietary rating has not been named yet, and
 * shipping a temporary name in one place beats scattering a placeholder
 * through fifty screens. When the real name lands, it lands here.
 */
export const RATING_LABEL = 'Performance rating';
