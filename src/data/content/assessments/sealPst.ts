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
 * The SEAL practice assessment, modelled on the Physical Screening Test.
 *
 * The published PST swims 500 yards; this practice battery uses the 500m
 * event the catalog models, and says so rather than pretending the two are
 * the same distance.
 */
export const SEAL_PST: AssessmentDefinition = {
  id: 'seal_pst',
  version: 1,
  pipelineId: 'navy_seal',
  name: 'Physical Screening Test',
  shortName: 'PST',
  events: [
    { eventId: 'swim_500m', transitionRestSeconds: null },
    { eventId: 'push_ups', transitionRestSeconds: null },
    { eventId: 'sit_ups', transitionRestSeconds: null },
    { eventId: 'pull_ups', transitionRestSeconds: null },
    { eventId: 'run_1_5_mile', transitionRestSeconds: null },
  ],
  completionRule: 'all_events',
  protocolNotes: [
    'Events are performed in this order, swim first and run last, as one continuous assessment.',
    'The official PST swims 500 yards; this practice battery uses the 500-metre event and is scored as such.',
    'Prescribed rest between events is not yet sourced from an authoritative document, so none is shown.',
  ],
  provenance: 'provisional',
};

export const SEAL_PST_SCORING: ScoringConfig = {
  definitionId: 'seal_pst',
  definitionVersion: 1,
  configVersion: 1,
  events: [
    SWIM_500M_CURVE_V1,
    PUSH_UPS_CURVE_V1,
    SIT_UPS_CURVE_V1,
    PULL_UPS_CURVE_V1,
    RUN_1_5_MILE_CURVE_V1,
  ],
  bands: RATING_BANDS_V1,
  provenance: 'provisional',
};
