import { findAssessmentEvent } from '@/domain/assessment/types';
import { definitionEventIds } from '@/domain/attempt/definition';
import { RATING_MAX, RATING_MIN } from '@/domain/scoring/config';
import { scoreAttempt } from '@/domain/scoring/score';

import {
  ASSESSMENT_DEFINITIONS,
  assessmentForPipeline,
  findAssessmentDefinition,
  SCORING_CONFIGS,
  scoringConfigFor,
} from './index';

/**
 * Catalog integrity: every shipped definition and config must be internally
 * consistent, because nothing downstream re-validates them. A bad anchor
 * would otherwise surface as a wrong rating on someone's profile.
 */

describe('assessment definitions', () => {
  it('reference only events that exist in the catalog', () => {
    for (const definition of ASSESSMENT_DEFINITIONS) {
      for (const eventId of definitionEventIds(definition)) {
        expect(findAssessmentEvent(eventId)).toBeDefined();
      }
    }
  });

  it('never repeat an event within one definition', () => {
    for (const definition of ASSESSMENT_DEFINITIONS) {
      const ids = definitionEventIds(definition);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('are unique by (id, version)', () => {
    const keys = ASSESSMENT_DEFINITIONS.map((d) => `${d.id}@${d.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('resolve by pipeline for the three modelled pipelines', () => {
    expect(assessmentForPipeline('pararescue')?.id).toBe('pj_ift');
    expect(assessmentForPipeline('navy_seal')?.id).toBe('seal_pst');
    expect(assessmentForPipeline('army_ranger')?.id).toBe('ranger_practice_battery');
    // Pipelines without a definition get honesty, not a borrowed protocol.
    expect(assessmentForPipeline('combat_control')).toBeUndefined();
  });

  it('resolve by id and version', () => {
    expect(findAssessmentDefinition('pj_ift')?.version).toBe(1);
    expect(findAssessmentDefinition('pj_ift', 1)?.id).toBe('pj_ift');
    expect(findAssessmentDefinition('pj_ift', 99)).toBeUndefined();
    expect(findAssessmentDefinition('nope')).toBeUndefined();
  });
});

describe('scoring configs', () => {
  it('exist for every shipped definition version', () => {
    for (const definition of ASSESSMENT_DEFINITIONS) {
      const config = scoringConfigFor(definition.id, definition.version);
      expect(config).toBeDefined();
    }
  });

  it('cover exactly the events of their definition', () => {
    for (const config of SCORING_CONFIGS) {
      const definition = findAssessmentDefinition(config.definitionId, config.definitionVersion);
      expect(definition).toBeDefined();
      const definitionEvents = [...definitionEventIds(definition!)].sort();
      const configEvents = config.events.map((curve) => curve.eventId).sort();
      expect(configEvents).toEqual(definitionEvents);
    }
  });

  it('use strictly ascending anchor values with in-range points', () => {
    for (const config of SCORING_CONFIGS) {
      for (const curve of config.events) {
        expect(curve.anchors.length).toBeGreaterThanOrEqual(2);
        expect(curve.weight).toBeGreaterThan(0);
        for (let index = 0; index < curve.anchors.length; index += 1) {
          const anchor = curve.anchors[index]!;
          expect(anchor.points).toBeGreaterThanOrEqual(RATING_MIN);
          expect(anchor.points).toBeLessThanOrEqual(RATING_MAX);
          if (index > 0) {
            expect(anchor.value).toBeGreaterThan(curve.anchors[index - 1]!.value);
          }
        }
      }
    }
  });

  it('score in the direction the event catalog declares', () => {
    // Points must be monotone along each curve, rising for rep events and
    // falling for timed events. A curve that reverses direction mid-way
    // would reward getting worse.
    for (const config of SCORING_CONFIGS) {
      for (const curve of config.events) {
        const event = findAssessmentEvent(curve.eventId)!;
        for (let index = 1; index < curve.anchors.length; index += 1) {
          const delta = curve.anchors[index]!.points - curve.anchors[index - 1]!.points;
          if (event.direction === 'higher_is_better') {
            expect(delta).toBeGreaterThanOrEqual(0);
          } else {
            expect(delta).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it('rate the brief’s example attempt inside the scale', () => {
    // PJ IFT: pull-ups 18, sit-ups 71, push-ups 64, run 8:57, swim 9:08.
    const config = scoringConfigFor('pj_ift', 1)!;
    const score = scoreAttempt(config, [
      { eventId: 'pull_ups', value: 18, order: 0 },
      { eventId: 'sit_ups', value: 71, order: 1 },
      { eventId: 'push_ups', value: 64, order: 2 },
      { eventId: 'run_1_5_mile', value: 537, order: 3 },
      { eventId: 'swim_500m', value: 548, order: 4 },
    ]);
    expect(score.complete).toBe(true);
    expect(score.rating).toBeGreaterThan(RATING_MIN);
    expect(score.rating).toBeLessThan(RATING_MAX);
  });

  it('declare themselves provisional until calibrated', () => {
    for (const config of SCORING_CONFIGS) {
      expect(config.provenance).toBe('provisional');
    }
  });
});
