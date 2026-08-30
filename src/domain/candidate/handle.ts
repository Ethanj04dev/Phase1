/**
 * Handle rules for candidate identity.
 *
 * The handle is the candidate's public name everywhere: leaderboards,
 * profiles, achievements. Real names are never required. One canonical
 * lowercase form is stored for uniqueness — @Ethan and @ethan are the same
 * person — alongside the exact casing the candidate typed, which is what
 * everyone sees.
 *
 * Validation lives here as a pure function so the onboarding screen, the
 * settings screen and the migration path all enforce exactly the same rules,
 * and so the rules are unit-testable without a device. The database repeats
 * the structural rules as CHECK constraints; this module is the friendly
 * version that can explain itself.
 */

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;

/**
 * Names that would let a handle impersonate the product or fake authority.
 * Checked against the normalized form, so casing offers no way around it.
 */
export const RESERVED_HANDLES: readonly string[] = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'staff',
  'support',
  'help',
  'official',
  'verified',
  'verify',
  'verification',
  'proctor',
  'zerophase',
  'zero_phase',
  'team',
  'system',
  'root',
  'api',
  'everyone',
  'anonymous',
  'deleted',
  'unknown',
  'null',
  'undefined',
];

/**
 * Canonical form: leading @ stripped, whitespace trimmed, lowercased.
 *
 * This is what uniqueness is measured against and what the database stores in
 * the `handle` column. It deliberately does NOT remove invalid characters —
 * normalization answers "which handle is this", not "is this handle valid".
 */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export type HandleProblem =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'invalid_characters'
  | 'must_start_with_letter'
  | 'reserved';

export type HandleValidation =
  | {
      ok: true;
      /** Canonical lowercase form, for storage and uniqueness. */
      handle: string;
      /** The candidate's own casing, for display. */
      displayHandle: string;
    }
  | { ok: false; problem: HandleProblem; message: string };

const PROBLEM_MESSAGES: Record<HandleProblem, string> = {
  empty: 'Choose a handle.',
  too_short: `Handles need at least ${HANDLE_MIN_LENGTH} characters.`,
  too_long: `Handles can be at most ${HANDLE_MAX_LENGTH} characters.`,
  invalid_characters: 'Letters, numbers and underscores only.',
  must_start_with_letter: 'Handles start with a letter.',
  reserved: 'That handle is reserved.',
};

function problem(kind: HandleProblem): HandleValidation {
  return { ok: false, problem: kind, message: PROBLEM_MESSAGES[kind] };
}

export function validateHandle(input: string): HandleValidation {
  // Validate the display form (casing kept) so the stored displayHandle is
  // exactly what passed validation, with only the @ and whitespace removed.
  const displayHandle = input.trim().replace(/^@+/, '');
  const handle = displayHandle.toLowerCase();

  if (handle.length === 0) {
    return problem('empty');
  }
  if (handle.length < HANDLE_MIN_LENGTH) {
    return problem('too_short');
  }
  if (handle.length > HANDLE_MAX_LENGTH) {
    return problem('too_long');
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return problem('invalid_characters');
  }
  if (!/^[a-z]/.test(handle)) {
    return problem('must_start_with_letter');
  }
  if (RESERVED_HANDLES.includes(handle)) {
    return problem('reserved');
  }

  return { ok: true, handle, displayHandle };
}
