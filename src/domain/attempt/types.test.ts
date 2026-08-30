import type { AssessmentDefinition } from './definition';
import {
  isAttemptComplete,
  isLeaderboardEligible,
  sortAttemptsByOccurrence,
  type AssessmentAttempt,
  type AttemptEventResult,
} from './types';

const DEFINITION: AssessmentDefinition = {
  id: 'test_battery',
  version: 1,
  pipelineId: 'pararescue',
  name: 'Test battery',
  shortName: 'BATTERY',
  events: [
    { eventId: 'pull_ups', transitionRestSeconds: null },
    { eventId: 'run_1_5_mile', transitionRestSeconds: null },
  ],
  completionRule: 'all_events',
  protocolNotes: [],
  provenance: 'provisional',
};

function attempt(overrides: Partial<AssessmentAttempt>): AssessmentAttempt {
  return {
    id: 'attempt-1',
    athleteId: 'athlete-1',
    definitionId: 'test_battery',
    definitionVersion: 1,
    pipelineId: 'pararescue',
    status: 'completed',
    occurredAt: '2026-08-29T10:00:00.000Z',
    startedAt: null,
    completedAt: null,
    submittedAt: null,
    verifiedAt: null,
    verificationStatus: 'self_reported',
    verificationMethod: 'self_reported',
    results: [],
    estimatedRating: 700,
    scoringConfigVersion: 1,
    officialRating: null,
    notes: null,
    createdAt: '2026-08-29T10:00:00.000Z',
    ...overrides,
  };
}

describe('isAttemptComplete', () => {
  const both: AttemptEventResult[] = [
    { eventId: 'pull_ups', value: 18, order: 0 },
    { eventId: 'run_1_5_mile', value: 537, order: 1 },
  ];

  it('requires every event in the definition', () => {
    expect(isAttemptComplete(DEFINITION, both)).toBe(true);
    expect(isAttemptComplete(DEFINITION, both.slice(0, 1))).toBe(false);
    expect(isAttemptComplete(DEFINITION, [])).toBe(false);
  });

  it('extra events do not substitute for missing ones', () => {
    expect(
      isAttemptComplete(DEFINITION, [
        { eventId: 'pull_ups', value: 18, order: 0 },
        { eventId: 'push_ups', value: 60, order: 1 },
      ]),
    ).toBe(false);
  });
});

describe('isLeaderboardEligible', () => {
  /**
   * The product's foundational rule. Self-reported never ranks; incomplete
   * never ranks; nothing ranks without a server-issued official rating.
   */
  it('rejects self-reported attempts, whatever else they carry', () => {
    expect(
      isLeaderboardEligible(
        attempt({ verificationStatus: 'self_reported', officialRating: 900 }),
      ),
    ).toBe(false);
  });

  it('rejects pending and rejected attempts', () => {
    expect(
      isLeaderboardEligible(
        attempt({ verificationStatus: 'pending_review', officialRating: 900 }),
      ),
    ).toBe(false);
    expect(
      isLeaderboardEligible(attempt({ verificationStatus: 'rejected', officialRating: 900 })),
    ).toBe(false);
  });

  it('rejects incomplete attempts even when verified', () => {
    for (const status of ['incomplete', 'aborted', 'failed'] as const) {
      expect(
        isLeaderboardEligible(
          attempt({ status, verificationStatus: 'zero_verified', officialRating: 800 }),
        ),
      ).toBe(false);
    }
  });

  it('rejects verified attempts with no official rating', () => {
    expect(
      isLeaderboardEligible(
        attempt({ verificationStatus: 'zero_verified', officialRating: null }),
      ),
    ).toBe(false);
  });

  it('accepts a complete, verified attempt with a server-issued rating', () => {
    expect(
      isLeaderboardEligible(
        attempt({ verificationStatus: 'zero_verified', officialRating: 812 }),
      ),
    ).toBe(true);
    expect(
      isLeaderboardEligible(attempt({ verificationStatus: 'proctored', officialRating: 812 })),
    ).toBe(true);
  });

  it('an estimated rating alone never makes anything eligible', () => {
    expect(isLeaderboardEligible(attempt({ estimatedRating: 999 }))).toBe(false);
  });
});

describe('sortAttemptsByOccurrence', () => {
  it('orders newest first without mutating the input', () => {
    const attempts = [
      attempt({ id: 'a', occurredAt: '2026-05-12T10:00:00.000Z' }),
      attempt({ id: 'c', occurredAt: '2026-08-29T10:00:00.000Z' }),
      attempt({ id: 'b', occurredAt: '2026-06-20T10:00:00.000Z' }),
    ];
    const sorted = sortAttemptsByOccurrence(attempts);
    expect(sorted.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(attempts.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });
});
