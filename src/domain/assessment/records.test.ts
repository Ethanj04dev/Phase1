import {
  buildAllEventProgress,
  buildEventProgress,
  buildPersonalRecords,
  groupResultsByEvent,
  isPersonalRecord,
  personalRecordFor,
} from './records';
import {
  ASSESSMENT_EVENTS,
  findAssessmentEvent,
  type AssessmentEventId,
  type AssessmentResult,
} from './types';

let counter = 0;

function result(
  eventId: AssessmentEventId,
  value: number,
  recordedAt: string,
): AssessmentResult {
  counter += 1;
  return {
    id: `r${counter}`,
    athleteId: 'athlete-1',
    eventId,
    value,
    recordedAt,
    notes: null,
  };
}

const pullUps = findAssessmentEvent('pull_ups')!;
const mile15 = findAssessmentEvent('run_1_5_mile')!;

describe('personalRecordFor', () => {
  it('returns null when the event has never been tested', () => {
    expect(personalRecordFor(pullUps, [])).toBeNull();
  });

  it('takes the highest value when higher is better', () => {
    const record = personalRecordFor(pullUps, [
      result('pull_ups', 10, '2026-01-01T00:00:00.000Z'),
      result('pull_ups', 18, '2026-02-01T00:00:00.000Z'),
      result('pull_ups', 15, '2026-03-01T00:00:00.000Z'),
    ]);
    expect(record?.value).toBe(18);
    expect(record?.achievedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('takes the lowest value when lower is better', () => {
    const record = personalRecordFor(mile15, [
      result('run_1_5_mile', 642, '2026-01-01T00:00:00.000Z'),
      result('run_1_5_mile', 568, '2026-02-01T00:00:00.000Z'),
      result('run_1_5_mile', 601, '2026-03-01T00:00:00.000Z'),
    ]);
    expect(record?.value).toBe(568);
    expect(record?.achievedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  // A record belongs to the day it was set, not the last day it was matched.
  it('keeps the original date when a later result merely ties the record', () => {
    const record = personalRecordFor(pullUps, [
      result('pull_ups', 18, '2026-01-01T00:00:00.000Z'),
      result('pull_ups', 18, '2026-06-01T00:00:00.000Z'),
    ]);
    expect(record?.value).toBe(18);
    expect(record?.achievedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('is unaffected by input ordering', () => {
    const ordered = [
      result('pull_ups', 10, '2026-01-01T00:00:00.000Z'),
      result('pull_ups', 18, '2026-02-01T00:00:00.000Z'),
    ];
    expect(personalRecordFor(pullUps, ordered)).toEqual(
      personalRecordFor(pullUps, [...ordered].reverse()),
    );
  });
});

describe('buildEventProgress', () => {
  it('reports improvement from the first result to the latest', () => {
    // The example from the product brief: 10:42 down to 9:28 is 1:14 faster.
    const progress = buildEventProgress(mile15, [
      result('run_1_5_mile', 642, '2026-01-01T00:00:00.000Z'),
      result('run_1_5_mile', 621, '2026-02-01T00:00:00.000Z'),
      result('run_1_5_mile', 598, '2026-03-01T00:00:00.000Z'),
      result('run_1_5_mile', 582, '2026-04-01T00:00:00.000Z'),
      result('run_1_5_mile', 568, '2026-05-01T00:00:00.000Z'),
    ]);
    expect(progress.improvement).toBe(74);
    expect(progress.first?.value).toBe(642);
    expect(progress.latest?.value).toBe(568);
    expect(progress.previous?.value).toBe(582);
  });

  it('signs improvement so positive always means better, for rep events too', () => {
    const progress = buildEventProgress(pullUps, [
      result('pull_ups', 10, '2026-01-01T00:00:00.000Z'),
      result('pull_ups', 18, '2026-02-01T00:00:00.000Z'),
    ]);
    expect(progress.improvement).toBe(8);
  });

  it('reports a negative improvement when performance declines', () => {
    const progress = buildEventProgress(mile15, [
      result('run_1_5_mile', 568, '2026-01-01T00:00:00.000Z'),
      result('run_1_5_mile', 601, '2026-02-01T00:00:00.000Z'),
    ]);
    expect(progress.improvement).toBe(-33);
  });

  it('has no improvement or previous result from a single test', () => {
    const progress = buildEventProgress(pullUps, [
      result('pull_ups', 12, '2026-01-01T00:00:00.000Z'),
    ]);
    expect(progress.improvement).toBeNull();
    expect(progress.previous).toBeNull();
    expect(progress.first).toBe(progress.latest);
  });

  it('orders history oldest first regardless of input order', () => {
    const progress = buildEventProgress(pullUps, [
      result('pull_ups', 18, '2026-03-01T00:00:00.000Z'),
      result('pull_ups', 10, '2026-01-01T00:00:00.000Z'),
      result('pull_ups', 14, '2026-02-01T00:00:00.000Z'),
    ]);
    expect(progress.history.map((r) => r.value)).toEqual([10, 14, 18]);
  });
});

describe('groupResultsByEvent', () => {
  it('drops results for events the catalog no longer knows', () => {
    const grouped = groupResultsByEvent([
      result('pull_ups', 10, '2026-01-01T00:00:00.000Z'),
      {
        ...result('pull_ups', 5, '2026-01-01T00:00:00.000Z'),
        eventId: 'retired_event' as AssessmentEventId,
      },
    ]);
    expect(grouped.size).toBe(1);
    expect(grouped.get('pull_ups')).toHaveLength(1);
  });
});

describe('buildAllEventProgress and buildPersonalRecords', () => {
  const results = [
    result('pull_ups', 10, '2026-01-01T00:00:00.000Z'),
    result('pull_ups', 18, '2026-02-01T00:00:00.000Z'),
    result('run_1_5_mile', 642, '2026-01-01T00:00:00.000Z'),
  ];

  it('includes only events that have results', () => {
    const progress = buildAllEventProgress(ASSESSMENT_EVENTS, results);
    expect(progress.map((p) => p.event.id).sort()).toEqual(['pull_ups', 'run_1_5_mile']);
  });

  it('returns nothing for an athlete with no history', () => {
    expect(buildAllEventProgress(ASSESSMENT_EVENTS, [])).toEqual([]);
    expect(buildPersonalRecords(ASSESSMENT_EVENTS, [])).toEqual([]);
  });

  it('builds one record per tested event', () => {
    const records = buildPersonalRecords(ASSESSMENT_EVENTS, results);
    expect(records).toHaveLength(2);
    expect(records.find((r) => r.event.id === 'pull_ups')?.value).toBe(18);
  });
});

describe('isPersonalRecord', () => {
  const older = result('pull_ups', 12, '2026-01-01T00:00:00.000Z');
  const best = result('pull_ups', 18, '2026-02-01T00:00:00.000Z');
  const worse = result('pull_ups', 14, '2026-03-01T00:00:00.000Z');
  const history = [older, best, worse];

  it('is true for a first ever result', () => {
    expect(isPersonalRecord(pullUps, older, [older])).toBe(true);
  });

  it('is true for the best result in the history', () => {
    expect(isPersonalRecord(pullUps, best, history)).toBe(true);
  });

  it('is false for a result beaten by an earlier one', () => {
    expect(isPersonalRecord(pullUps, worse, history)).toBe(false);
  });

  it('is false for a result that only ties the record', () => {
    const tie = result('pull_ups', 18, '2026-04-01T00:00:00.000Z');
    expect(isPersonalRecord(pullUps, tie, [...history, tie])).toBe(false);
  });
});
