import { useCallback } from 'react';

import { useRepositories } from '@/data/repositoryContext';
import type { ProgramPosition, ProgramSummary } from '@/data/repositories/types';
import {
  buildAllEventProgress,
  buildPersonalRecords,
  type EventProgress,
  type PersonalRecord,
} from '@/domain/assessment/records';
import { ASSESSMENT_EVENTS, type AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import {
  baselineWithin,
  biggestDecline,
  biggestGain,
  domainMovement,
  type DomainMovement,
} from '@/domain/readiness/movement';
import type { ReadinessSnapshot, ReadinessTrend } from '@/domain/readiness/types';
import type { RoadToReady } from '@/domain/pipeline/roadToReady';
import type { PipelineDefinition } from '@/domain/pipeline/types';
import { loadPipelineSnapshot } from '@/features/pipeline/pipelineSnapshot';
import { volumeToDate, weeklyVolume, type WeeklyVolume } from '@/domain/training/volume';
import { err, ok, type Result } from '@/domain/types';
import { useAsyncResource, type AsyncResource } from '@/lib/useAsyncResource';

export interface ProgressOverview {
  profile: AthleteProfile;
  results: readonly AssessmentResult[];
  records: readonly PersonalRecord[];
  progress: readonly EventProgress[];
  readiness: ReadinessSnapshot | null;
  /**
   * Movement on the Target scale, derived from Target-aware snapshots only.
   *
   * Not the stored legacy trend: a delta measured on one scale printed under a
   * score from another is worse than no delta at all.
   */
  trend: ReadinessTrend | null;
  pipeline: PipelineDefinition | null;
  road: RoadToReady | null;
  /** Oldest first, ready to plot. */
  readinessHistory: readonly ReadinessSnapshot[];
  /**
   * History scored against the athlete's current Target, oldest first.
   *
   * Filtered rather than converted. Snapshots from another Target, or from
   * before Targets existed, describe a different scale and cannot share an
   * axis with these.
   */
  pipelineHistory: readonly ReadinessSnapshot[];
  /** Snapshots left out of the chart because they use a different scale. */
  offScaleCount: number;
  movements: readonly DomainMovement[];
  gain: DomainMovement | null;
  decline: DomainMovement | null;
  volume: readonly WeeklyVolume[];
  program: ProgramSummary | null;
  position: ProgramPosition | null;
}

const READINESS_TREND_WINDOW_DAYS = 30;
/** Enough history for the charts without loading a full career. */
const HISTORY_PAGE_SIZE = 60;

const NO_PROFILE_ERROR = {
  code: 'not_found' as const,
  message: 'We could not find your athlete profile.',
};

export function useProgressOverview(): AsyncResource<ProgressOverview> {
  const { athlete, assessment, proficiency, readiness, training, workout } = useRepositories();

  const fetcher = useCallback(async (): Promise<Result<ProgressOverview>> => {
    const profileResult = await athlete.getCurrentProfile();
    if (!profileResult.ok) {
      return profileResult;
    }
    const profile = profileResult.value;
    if (!profile) {
      return err(NO_PROFILE_ERROR);
    }

    const [
      resultsOutcome,
      latestOutcome,
      targetOutcome,
      historyOutcome,
      workoutsOutcome,
      programOutcome,
      positionOutcome,
    ] = await Promise.all([
      assessment.listResults(profile.id, { limit: HISTORY_PAGE_SIZE }),
      readiness.getLatest(profile.id),
      loadPipelineSnapshot({ assessment, proficiency, training }, profile),
      readiness.listHistory(profile.id, { limit: HISTORY_PAGE_SIZE }),
      workout.listResults(profile.id, { limit: HISTORY_PAGE_SIZE }),
      training.getProgram(profile.id),
      training.getPosition(profile.id),
    ]);

    if (!resultsOutcome.ok) return resultsOutcome;
    if (!latestOutcome.ok) return latestOutcome;
    if (!targetOutcome.ok) return targetOutcome;
    if (!historyOutcome.ok) return historyOutcome;
    if (!workoutsOutcome.ok) return workoutsOutcome;
    if (!programOutcome.ok) return programOutcome;
    if (!positionOutcome.ok) return positionOutcome;

    const results = resultsOutcome.value;
    // The repository returns newest first for lists; charts read left to right.
    const chronology = [...historyOutcome.value].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt),
    );

    const baseline = baselineWithin(
      chronology,
      READINESS_TREND_WINDOW_DAYS,
      new Date().toISOString(),
    );
    const movements = domainMovement(latestOutcome.value, baseline);

    // The chart plots one scale. A snapshot recorded against a different
    // Target, or before Targets existed, is real history and is kept, but it
    // measures something else and cannot share an axis.
    const currentPipelineId = latestOutcome.value?.target?.targetId ?? null;
    const pipelineHistory = currentPipelineId
      ? chronology.filter((snapshot) => snapshot.target?.targetId === currentPipelineId)
      : [];

    // Measured across Target-aware snapshots only, so the delta and the score
    // it sits under are the same kind of number.
    const targetBaseline = baselineWithin(
      pipelineHistory,
      READINESS_TREND_WINDOW_DAYS,
      new Date().toISOString(),
    );
    const currentTargetScore = latestOutcome.value?.target?.overall ?? null;
    const targetTrend: ReadinessTrend | null =
      currentTargetScore === null
        ? null
        : {
            delta: currentTargetScore - (targetBaseline?.target?.overall ?? currentTargetScore),
            windowDays: READINESS_TREND_WINDOW_DAYS,
            comparedTo: targetBaseline?.recordedAt ?? null,
          };

    const program = programOutcome.value;
    const position = positionOutcome.value;
    const buckets = program
      ? weeklyVolume(workoutsOutcome.value, profile.createdAt, program.program.durationWeeks)
      : [];

    return ok({
      profile,
      results,
      records: buildPersonalRecords(ASSESSMENT_EVENTS, results),
      progress: buildAllEventProgress(ASSESSMENT_EVENTS, results),
      readiness: latestOutcome.value,
      trend: targetTrend,
      pipeline: targetOutcome.value.pipeline,
      road: targetOutcome.value.road,
      readinessHistory: chronology,
      pipelineHistory,
      offScaleCount: chronology.length - pipelineHistory.length,
      movements,
      gain: biggestGain(movements),
      decline: biggestDecline(movements),
      // Future weeks would render as a run of empty bars implying missed
      // training the athlete has not reached yet.
      volume: position ? volumeToDate(buckets, position.weekNumber) : buckets,
      program,
      position,
    });
  }, [assessment, athlete, proficiency, readiness, training, workout]);

  return useAsyncResource(fetcher);
}
