import type { AssessmentDefinition } from '@/domain/attempt/definition';
import type { GoalId } from '@/domain/goals/types';
import type { ScoringConfig } from '@/domain/scoring/config';

import { PJ_IFT, PJ_IFT_SCORING } from './pjIft';
import { RANGER_BATTERY, RANGER_BATTERY_SCORING } from './rangerBattery';
import { SEAL_PST, SEAL_PST_SCORING } from './sealPst';

/**
 * The assessment catalog: protocols and their scoring configs, versioned.
 *
 * Adding an assessment means adding a definition file here and nothing else.
 * Changing a protocol means adding a NEW version, never editing an old one in
 * place — attempts stamp the version they were performed under, and history
 * must keep meaning what it meant.
 */

export const ASSESSMENT_DEFINITIONS: readonly AssessmentDefinition[] = [
  PJ_IFT,
  SEAL_PST,
  RANGER_BATTERY,
];

export const SCORING_CONFIGS: readonly ScoringConfig[] = [
  PJ_IFT_SCORING,
  SEAL_PST_SCORING,
  RANGER_BATTERY_SCORING,
];

/**
 * A specific protocol version, for rendering historical attempts exactly as
 * they were performed. Omitting `version` returns the latest.
 */
export function findAssessmentDefinition(
  id: string,
  version?: number,
): AssessmentDefinition | undefined {
  const candidates = ASSESSMENT_DEFINITIONS.filter((definition) => definition.id === id);
  if (candidates.length === 0) {
    return undefined;
  }
  if (version !== undefined) {
    return candidates.find((definition) => definition.version === version);
  }
  return candidates.reduce((latest, candidate) =>
    candidate.version > latest.version ? candidate : latest,
  );
}

/**
 * The current assessment for a pipeline, if one is defined. Pipelines without
 * one show honest practice-only screens rather than a borrowed protocol.
 */
export function assessmentForPipeline(pipelineId: GoalId): AssessmentDefinition | undefined {
  const candidates = ASSESSMENT_DEFINITIONS.filter(
    (definition) => definition.pipelineId === pipelineId,
  );
  if (candidates.length === 0) {
    return undefined;
  }
  return candidates.reduce((latest, candidate) =>
    candidate.version > latest.version ? candidate : latest,
  );
}

/** The latest scoring config for a protocol version. */
export function scoringConfigFor(
  definitionId: string,
  definitionVersion: number,
): ScoringConfig | undefined {
  const candidates = SCORING_CONFIGS.filter(
    (config) =>
      config.definitionId === definitionId && config.definitionVersion === definitionVersion,
  );
  if (candidates.length === 0) {
    return undefined;
  }
  return candidates.reduce((latest, candidate) =>
    candidate.configVersion > latest.configVersion ? candidate : latest,
  );
}

export { PJ_IFT, SEAL_PST, RANGER_BATTERY };
