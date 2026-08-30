import type { AttemptEventResult } from '@/domain/attempt/types';

import { ratingBand, type ScoringConfig } from './config';
import { scoreAttempt, scoreEvent } from './score';

/**
 * A small config with one rep event and one timed event, so the numbers in
 * every expectation can be checked by hand.
 */
const CONFIG: ScoringConfig = {
  definitionId: 'test_battery',
  definitionVersion: 1,
  configVersion: 7,
  events: [
    {
      eventId: 'pull_ups',
      weight: 1,
      anchors: [
        { value: 0, points: 0 },
        { value: 10, points: 500 },
        { value: 20, points: 800 },
        { value: 30, points: 1000 },
      ],
    },
    {
      eventId: 'run_1_5_mile',
      weight: 1,
      anchors: [
        { value: 480, points: 1000 },
        { value: 600, points: 500 },
        { value: 720, points: 0 },
      ],
    },
  ],
  bands: [
    { id: 'developing', label: 'Developing', floor: 0 },
    { id: 'competitive', label: 'Competitive', floor: 550 },
    { id: 'elite', label: 'Elite', floor: 850 },
  ],
  provenance: 'provisional',
};

const pullUps = CONFIG.events[0]!;
const run = CONFIG.events[1]!;

function results(entries: Partial<Record<string, number>>): AttemptEventResult[] {
  return Object.entries(entries).map(([eventId, value], order) => ({
    eventId: eventId as AttemptEventResult['eventId'],
    value: value!,
    order,
  }));
}

describe('scoreEvent', () => {
  it('returns anchor points exactly at an anchor', () => {
    expect(scoreEvent(pullUps, 10)).toBe(500);
    expect(scoreEvent(pullUps, 30)).toBe(1000);
  });

  it('interpolates linearly between anchors', () => {
    expect(scoreEvent(pullUps, 15)).toBe(650);
    expect(scoreEvent(pullUps, 25)).toBe(900);
  });

  it('supports nonlinear curves: the same improvement buys different points', () => {
    // 0→10 pull-ups is worth 500 points; 20→30 is worth 200. Diminishing
    // returns are a property of the anchors, not special-cased anywhere.
    expect(scoreEvent(pullUps, 10) - scoreEvent(pullUps, 0)).toBe(500);
    expect(scoreEvent(pullUps, 30) - scoreEvent(pullUps, 20)).toBe(200);
  });

  it('scores timed events with falling points as seconds rise', () => {
    expect(scoreEvent(run, 480)).toBe(1000);
    expect(scoreEvent(run, 540)).toBe(750);
    expect(scoreEvent(run, 720)).toBe(0);
  });

  it('clamps outside the anchor range instead of extrapolating', () => {
    expect(scoreEvent(pullUps, 50)).toBe(1000);
    expect(scoreEvent(run, 400)).toBe(1000); // faster than the fastest anchor
    expect(scoreEvent(run, 900)).toBe(0); // slower than the slowest
  });
});

describe('scoreAttempt', () => {
  it('rates a complete attempt as the weighted average, rounded', () => {
    const score = scoreAttempt(CONFIG, results({ pull_ups: 20, run_1_5_mile: 540 }));
    expect(score.complete).toBe(true);
    expect(score.rating).toBe(775); // (800 + 750) / 2
    expect(score.configVersion).toBe(7);
  });

  it('refuses to rate an incomplete attempt', () => {
    const score = scoreAttempt(CONFIG, results({ pull_ups: 20 }));
    expect(score.complete).toBe(false);
    expect(score.rating).toBeNull();
    // The performed event still gets its own points, for training feedback.
    expect(score.eventScores).toEqual([{ eventId: 'pull_ups', value: 20, points: 800 }]);
  });

  it('refuses to rate an empty attempt', () => {
    const score = scoreAttempt(CONFIG, []);
    expect(score.complete).toBe(false);
    expect(score.rating).toBeNull();
    expect(score.eventScores).toEqual([]);
  });

  it('respects event weights', () => {
    const weighted: ScoringConfig = {
      ...CONFIG,
      events: [
        { ...pullUps, weight: 3 },
        { ...run, weight: 1 },
      ],
    };
    const score = scoreAttempt(weighted, results({ pull_ups: 20, run_1_5_mile: 540 }));
    expect(score.rating).toBe(788); // (800*3 + 750) / 4 = 787.5 → 788
  });

  it('ignores results for events the config does not score', () => {
    const score = scoreAttempt(
      CONFIG,
      results({ pull_ups: 20, run_1_5_mile: 540, push_ups: 60 }),
    );
    expect(score.rating).toBe(775);
    expect(score.eventScores).toHaveLength(2);
  });
});

describe('ratingBand', () => {
  it('places a rating in the highest band whose floor it clears', () => {
    expect(ratingBand(CONFIG, 0)?.id).toBe('developing');
    expect(ratingBand(CONFIG, 549)?.id).toBe('developing');
    expect(ratingBand(CONFIG, 550)?.id).toBe('competitive');
    expect(ratingBand(CONFIG, 1000)?.id).toBe('elite');
  });

  it('returns null when a config defines no bands', () => {
    expect(ratingBand({ ...CONFIG, bands: [] }, 700)).toBeNull();
  });
});
