import type { IsoDateTime, Uuid } from '@/domain/types';

import {
  proficiencyRank,
  type PreparationDomainId,
  type ProficiencyLevel,
} from './domains';
import type { ProficiencySkill, TargetDomain } from './types';

/**
 * Self-assessed skill levels.
 *
 * Stored as append-only history rather than as a mutable current value, for
 * the same reason assessment results are: an athlete should be able to see
 * that they were "developing" at treading in March and "competent" in July.
 * Overwriting a rating would destroy the only evidence that the work paid off.
 *
 * These are self-reported and the product says so. Nobody is watching, and a
 * generous rating only costs the athlete the accuracy of their own score.
 */
export interface ProficiencyRating {
  id: Uuid;
  athleteId: Uuid;
  domainId: PreparationDomainId;
  /** Matches a ProficiencySkill id on the Target's domain. */
  skillId: string;
  level: ProficiencyLevel;
  recordedAt: IsoDateTime;
  notes: string | null;
}

/** A rating before it has an id or a timestamp. */
export interface NewProficiencyRating {
  domainId: PreparationDomainId;
  skillId: string;
  level: ProficiencyLevel;
  notes?: string | null;
}

/**
 * Newest rating per skill.
 *
 * Newest, not highest. A skill can genuinely regress after months out of the
 * water, and a score built from personal bests would quietly stop reflecting
 * the present.
 */
export function latestRatingBySkill(
  ratings: readonly ProficiencyRating[],
): ReadonlyMap<string, ProficiencyRating> {
  const latest = new Map<string, ProficiencyRating>();
  for (const rating of ratings) {
    const held = latest.get(rating.skillId);
    if (!held || rating.recordedAt > held.recordedAt) {
      latest.set(rating.skillId, rating);
    }
  }
  return latest;
}

/** The shape the readiness engine consumes: skill id to current level. */
export function currentLevels(
  ratings: readonly ProficiencyRating[],
): Record<string, ProficiencyLevel> {
  const levels: Record<string, ProficiencyLevel> = {};
  for (const [skillId, rating] of latestRatingBySkill(ratings)) {
    levels[skillId] = rating.level;
  }
  return levels;
}

/** True when the athlete has reached the level suggested for this skill. */
export function meetsTarget(skill: ProficiencySkill, level: ProficiencyLevel): boolean {
  return proficiencyRank(level) >= proficiencyRank(skill.phase1Target);
}

export interface SkillStanding {
  skill: ProficiencySkill;
  /** Null when never rated. Not the same as "not started". */
  level: ProficiencyLevel | null;
  lastRatedAt: IsoDateTime | null;
  met: boolean;
}

/**
 * How the athlete stands on every skill in a domain.
 *
 * Unrated is deliberately distinct from `not_started`. One means the athlete
 * has never told us; the other means they have told us they cannot do it yet.
 * Collapsing the two would put words in their mouth and drag their score down
 * for a question they were never asked.
 */
export function skillStandings(
  domain: TargetDomain,
  ratings: readonly ProficiencyRating[],
): readonly SkillStanding[] {
  const latest = latestRatingBySkill(ratings);

  return (domain.proficiencySkills ?? []).map((skill) => {
    const rating = latest.get(skill.id);
    return {
      skill,
      level: rating?.level ?? null,
      lastRatedAt: rating?.recordedAt ?? null,
      met: rating ? meetsTarget(skill, rating.level) : false,
    };
  });
}

/** How many of a domain's skills have been rated at all, out of how many. */
export function ratedCount(standings: readonly SkillStanding[]): {
  rated: number;
  total: number;
} {
  return {
    rated: standings.filter((standing) => standing.level !== null).length,
    total: standings.length,
  };
}

/**
 * Skills that must not be practised alone.
 *
 * Exposed as a query rather than left for each screen to filter, so a new
 * surface cannot forget to check and quietly drop a safety marker.
 */
export function supervisedSkills(
  domain: TargetDomain,
): readonly ProficiencySkill[] {
  return (domain.proficiencySkills ?? []).filter((skill) => skill.requiresSupervision);
}
