import type { ExperienceLevel } from '@/domain/types';

import { recommendTrack, type TrackRecommendationInput } from './recommendTrack';

function input(
  readiness: number | null,
  running: ExperienceLevel,
  swimming: ExperienceLevel = running,
  rucking: ExperienceLevel = running,
): TrackRecommendationInput {
  return {
    readiness,
    runningExperience: running,
    swimmingExperience: swimming,
    ruckingExperience: rucking,
  };
}

describe('recommendTrack with a baseline', () => {
  it('starts a low baseline on foundation', () => {
    expect(recommendTrack(input(30, 'beginner')).trackId).toBe('foundation');
    expect(recommendTrack(input(44, 'advanced')).trackId).toBe('foundation');
  });

  it('puts a mid baseline on selection prep', () => {
    expect(recommendTrack(input(45, 'intermediate')).trackId).toBe('selection_prep');
    expect(recommendTrack(input(65, 'intermediate')).trackId).toBe('selection_prep');
    expect(recommendTrack(input(74, 'advanced')).trackId).toBe('selection_prep');
  });

  it('puts a strong all-round baseline on advanced', () => {
    expect(recommendTrack(input(75, 'advanced')).trackId).toBe('advanced');
    expect(recommendTrack(input(95, 'intermediate')).trackId).toBe('advanced');
  });

  // The guard that matters: a strong runner who has never swum should not be
  // handed advanced swim volume just because their overall score is high.
  it('holds a strong athlete back when one discipline is untrained', () => {
    const recommendation = recommendTrack(input(88, 'advanced', 'none', 'advanced'));
    expect(recommendation.trackId).toBe('selection_prep');
    expect(recommendation.rationale).toContain('discipline is still new');
  });

  it('treats beginner as untrained for the advanced guard', () => {
    expect(recommendTrack(input(90, 'advanced', 'beginner', 'advanced')).trackId).toBe(
      'selection_prep',
    );
  });
});

describe('recommendTrack without a baseline', () => {
  it('falls back to experience when every test was deferred', () => {
    expect(recommendTrack(input(null, 'none')).trackId).toBe('foundation');
    expect(recommendTrack(input(null, 'intermediate')).trackId).toBe('selection_prep');
    expect(recommendTrack(input(null, 'advanced')).trackId).toBe('advanced');
  });

  it('applies the untrained-discipline guard without a baseline too', () => {
    expect(recommendTrack(input(null, 'advanced', 'none', 'advanced')).trackId).toBe(
      'selection_prep',
    );
  });

  it('does not send a total beginner to advanced', () => {
    expect(recommendTrack(input(null, 'beginner', 'none', 'none')).trackId).toBe(
      'foundation',
    );
  });
});

describe('recommendTrack rationale', () => {
  it('always returns something showable to the athlete', () => {
    const cases: TrackRecommendationInput[] = [
      input(20, 'none'),
      input(60, 'intermediate'),
      input(90, 'advanced'),
      input(null, 'beginner'),
    ];
    for (const testCase of cases) {
      const { rationale } = recommendTrack(testCase);
      expect(rationale.length).toBeGreaterThan(10);
      expect(rationale.endsWith('.')).toBe(true);
    }
  });
});
