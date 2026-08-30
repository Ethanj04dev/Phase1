import type { AssessmentDefinition } from '@/domain/attempt/definition';
import type { ScoringConfig } from '@/domain/scoring/config';

import {
  PULL_UPS_CURVE_V1,
  PUSH_UPS_CURVE_V1,
  RATING_BANDS_V1,
  RUN_1_5_MILE_CURVE_V1,
  SIT_UPS_CURVE_V1,
  SWIM_500M_CURVE_V1,
} from './curves';

/**
 * The pararescue practice assessment, modelled on the Initial Fitness Test.
 *
 * Provisional, and honest about it: the event set and order follow the
 * commonly published IFT structure, but the protocol has not yet been sourced
 * from an authoritative document, so transition rests are unspecified rather
 * than invented. Sourcing the real protocol produces version 2; attempts
 * performed under version 1 keep saying version 1.
 */
export const PJ_IFT: AssessmentDefinition = {
  id: 'pj_ift',
  version: 1,
  pipelineId: 'pararescue',
  name: 'Initial Fitness Test',
  shortName: 'IFT',
  events: [
    { eventId: 'pull_ups', transitionRestSeconds: null },
    { eventId: 'sit_ups', transitionRestSeconds: null },
    { eventId: 'push_ups', transitionRestSeconds: null },
    { eventId: 'run_1_5_mile', transitionRestSeconds: null },
    { eventId: 'swim_500m', transitionRestSeconds: null },
  ],
  completionRule: 'all_events',
  protocolNotes: [
    'Events are performed in this order, as one continuous assessment.',
    'Prescribed rest between events is not yet sourced from an authoritative document, so none is shown.',
    'The official test also includes underwater events this practice battery does not model yet.',
  ],
  provenance: 'provisional',
};

export const PJ_IFT_SCORING: ScoringConfig = {
  definitionId: 'pj_ift',
  definitionVersion: 1,
  configVersion: 1,
  events: [
    PULL_UPS_CURVE_V1,
    SIT_UPS_CURVE_V1,
    PUSH_UPS_CURVE_V1,
    RUN_1_5_MILE_CURVE_V1,
    SWIM_500M_CURVE_V1,
  ],
  bands: RATING_BANDS_V1,
  provenance: 'provisional',
};
