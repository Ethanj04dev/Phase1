import { preparationDomain } from '@/domain/target/domains';
import type { RoadStep, RoadStepKind } from '@/domain/target/roadToReady';

/**
 * Turning a step into an instruction.
 *
 * Kept out of the domain layer because it is wording, not logic, and out of
 * the screens because three of them show this list and they must all phrase it
 * identically.
 */

export const ROAD_STEP_LABELS: Record<RoadStepKind, string> = {
  improve: 'Work on this',
  measure: 'Find out where you stand',
  maintain: 'Holding',
  unavailable: 'Not scored',
};

/**
 * One line telling the athlete what to actually do.
 *
 * A behavioural domain and a tested one both read "unmeasured" to the engine,
 * but the action is completely different: one is solved by logging sessions,
 * the other by taking a test. Saying "go test your consistency" would be
 * nonsense.
 */
export function roadStepInstruction(step: RoadStep): string {
  const domain = preparationDomain(step.domainId);

  switch (step.kind) {
    case 'measure':
      return domain.measurement === 'behavioural'
        ? 'Not enough training history yet. This scores itself once you have been logging sessions for a few weeks.'
        : domain.measurement === 'proficiency'
          ? 'Rate yourself against the skills in this area to bring it into your score.'
          : 'Never tested. Log an assessment so this stops being a blank on your profile.';
    case 'improve':
      // No claim about being the top priority here: the ordering and the
      // points line already say that, and repeating it on every row would
      // tell the athlete that six different things are the most important.
      return `Behind the Phase 1 benchmark, and ${Math.round(step.weight * 100)}% of your score.`;
    case 'maintain':
      // A domain averages its events, so it can sit at benchmark while one
      // event is still short. Saying "at benchmark" over a row that visibly
      // reads "0:10 to go" would look like the app cannot read its own data.
      return step.events.some((gap) => gap.current !== null && !gap.met)
        ? 'At the Phase 1 benchmark overall, though not every event is there yet.'
        : 'At or past the Phase 1 benchmark. Keep it there rather than chasing it further.';
    case 'unavailable':
      return 'Phase 1 has no assessment for this that is safe to ask an untrained athlete to attempt, so it carries no score. It still matters in training.';
  }
}

/** How much overall readiness a step is holding, in points. */
export function impactPoints(step: RoadStep): number {
  return Math.round(step.impact);
}
