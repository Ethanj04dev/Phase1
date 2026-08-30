import {
  composeAssessmentVerdict,
  integrityReasonLabel,
  isSessionResumable,
  VERDICT_LABELS,
  type VerificationSession,
} from './types';

describe('composeAssessmentVerdict', () => {
  it('verifies only when every event verifies', () => {
    expect(composeAssessmentVerdict(['verified', 'verified', 'verified'])).toBe('verified');
  });

  it('any failed event fails the assessment — four of five is not a pass', () => {
    expect(
      composeAssessmentVerdict(['verified', 'verified', 'failed', 'verified', 'verified']),
    ).toBe('failed');
  });

  it('ambiguity without failure abstains', () => {
    expect(composeAssessmentVerdict(['verified', 'unable_to_verify', 'verified'])).toBe(
      'unable_to_verify',
    );
  });

  it('failure outranks abstention', () => {
    expect(composeAssessmentVerdict(['unable_to_verify', 'failed'])).toBe('failed');
  });

  it('no events is not a pass', () => {
    expect(composeAssessmentVerdict([])).toBe('unable_to_verify');
  });
});

describe('labels', () => {
  it('every verdict has a label', () => {
    expect(Object.keys(VERDICT_LABELS).sort()).toEqual(
      ['failed', 'unable_to_verify', 'verified'].sort(),
    );
  });

  it('unknown integrity codes fall back to a safe human line', () => {
    expect(integrityReasonLabel('evidence_missing')).toMatch(/No evidence/);
    expect(integrityReasonLabel('some_future_code')).toMatch(/integrity/);
  });
});

describe('isSessionResumable', () => {
  const base: VerificationSession = {
    id: 's1',
    definitionId: 'pj_ift',
    definitionVersion: 1,
    pipelineId: 'pararescue',
    eventOrder: ['pull_ups'],
    challengeCode: 'K7F-29Q',
    challengeExpiresAt: '2026-08-29T16:00:00.000Z',
    status: 'active',
    openEvent: null,
    attemptId: null,
    createdAt: '2026-08-29T12:00:00.000Z',
    startedAt: '2026-08-29T12:01:00.000Z',
  };

  it('active or issued sessions resume while unexpired', () => {
    expect(isSessionResumable(base, '2026-08-29T13:00:00.000Z')).toBe(true);
    expect(isSessionResumable({ ...base, status: 'issued' }, '2026-08-29T13:00:00.000Z')).toBe(
      true,
    );
  });

  it('expired, submitted or abandoned sessions do not resume', () => {
    expect(isSessionResumable(base, '2026-08-29T17:00:00.000Z')).toBe(false);
    expect(
      isSessionResumable({ ...base, status: 'submitted' }, '2026-08-29T13:00:00.000Z'),
    ).toBe(false);
    expect(
      isSessionResumable({ ...base, status: 'abandoned' }, '2026-08-29T13:00:00.000Z'),
    ).toBe(false);
  });
});
