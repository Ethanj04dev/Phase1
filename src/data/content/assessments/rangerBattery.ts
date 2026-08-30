import type { AssessmentDefinition } from '@/domain/attempt/definition';
import type { ScoringConfig } from '@/domain/scoring/config';

import {
  PULL_UPS_CURVE_V1,
  PUSH_UPS_CURVE_V1,
  RATING_BANDS_V1,
  RUN_1_5_MILE_CURVE_V1,
  SIT_UPS_CURVE_V1,
} from './curves';

/**
 * The Ranger practice battery.
 *
 * Deliberately NOT named RPFT: the official Ranger fitness test runs five
 * miles, which the event catalog does not model yet, and naming this after
 * the real test while swapping the run would be exactly the kind of quiet
 * substitution the product refuses. When a five-mile event ships, an RPFT
 * definition arrives as its own protocol; this battery keeps its own history.
 */
export const RANGER_BATTERY: AssessmentDefinition = {
  id: 'ranger_practice_battery',
  version: 1,
  pipelineId: 'army_ranger',
  name: 'Ranger practice battery',
  shortName: 'BATTERY',
  events: [
    { eventId: 'push_ups', transitionRestSeconds: null },
    { eventId: 'sit_ups', transitionRestSeconds: null },
    { eventId: 'run_1_5_mile', transitionRestSeconds: null },
    { eventId: 'pull_ups', transitionRestSeconds: null },
  ],
  completionRule: 'all_events',
  protocolNotes: [
    'Events are performed in this order, as one continuous session.',
    'The official Ranger fitness test runs five miles; this practice battery uses the 1.5-mile event until a five-mile event is modelled, and is scored as its own protocol.',
    'Prescribed rest between events is not yet sourced from an authoritative document, so none is shown.',
  ],
  provenance: 'provisional',
};

export const RANGER_BATTERY_SCORING: ScoringConfig = {
  definitionId: 'ranger_practice_battery',
  definitionVersion: 1,
  configVersion: 1,
  events: [
    PUSH_UPS_CURVE_V1,
    SIT_UPS_CURVE_V1,
    RUN_1_5_MILE_CURVE_V1,
    PULL_UPS_CURVE_V1,
  ],
  bands: RATING_BANDS_V1,
  provenance: 'provisional',
};
