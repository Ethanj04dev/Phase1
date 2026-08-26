import { findAssessmentEvent } from '@/domain/assessment/types';
import { PREPARATION_DOMAINS, preparationDomain } from '@/domain/target/domains';
import { isVerified, type Verified } from '@/domain/target/provenance';
import { domainWeightsSumToOne, findDomain } from '@/domain/target/types';

import { findTarget, hasTargetDefinition, PARARESCUE, TARGETS } from './index';

/**
 * Content tests.
 *
 * These are not style checks. Each one guards a promise the product makes to
 * someone deciding how to spend a year of their life preparing.
 */

describe('target catalog', () => {
  it('finds a modelled target and reports an unmodelled one honestly', () => {
    expect(findTarget('pararescue')).toBe(PARARESCUE);
    expect(hasTargetDefinition('pararescue')).toBe(true);
    expect(findTarget('navy_seal')).toBeUndefined();
    expect(hasTargetDefinition('navy_seal')).toBe(false);
  });

  it.each(TARGETS.map((t) => [t.id, t] as const))('%s has unique domain ids', (_id, target) => {
    const ids = target.domains.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s domain weights sum to one',
    (_id, target) => {
      expect(domainWeightsSumToOne(target)).toBe(true);
    },
  );

  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s only uses domains the registry knows',
    (_id, target) => {
      for (const domain of target.domains) {
        expect(PREPARATION_DOMAINS).toContain(domain.id);
      }
    },
  );

  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s only references assessment events that exist',
    (_id, target) => {
      for (const domain of target.domains) {
        for (const eventId of domain.eventIds) {
          expect(findAssessmentEvent(eventId)).toBeDefined();
        }
      }
      for (const assessment of target.assessments) {
        expect(findAssessmentEvent(assessment.eventId)).toBeDefined();
      }
    },
  );

  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s explains why every domain matters',
    (_id, target) => {
      for (const domain of target.domains) {
        expect(domain.rationale.length).toBeGreaterThan(20);
      }
    },
  );
});

// --- The promises that matter -----------------------------------------------

describe('official data is never fabricated', () => {
  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s exposes no official figure without a cited source',
    (_id, target) => {
      for (const standard of target.officialStandards) {
        const requirement = standard.requirement;
        if (isVerified(requirement)) {
          // A verified figure must point at a source that actually exists.
          expect(
            target.sources.find((s) => s.id === requirement.sourceId),
          ).toBeDefined();
        } else {
          // An unverified one must carry no number at all.
          expect(
            Object.prototype.hasOwnProperty.call(standard.requirement, 'value'),
          ).toBe(false);
        }
      }
    },
  );

  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s cites a real source for every verified pipeline detail',
    (_id, target) => {
      for (const stage of target.pipeline) {
        const details: readonly (Verified<unknown> | undefined)[] = [
          stage.location,
          stage.durationWeeks,
        ];
        for (const detail of details) {
          if (detail && isVerified(detail)) {
            expect(target.sources.find((s) => s.id === detail.sourceId)).toBeDefined();
          }
        }
      }
    },
  );

  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s marks unsourced pipeline stages as placeholders',
    (_id, target) => {
      const anySourced = target.sources.length > 0;
      if (!anySourced) {
        for (const stage of target.pipeline) {
          expect(stage.isPlaceholder).toBe(true);
        }
      }
    },
  );

  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s makes every Phase 1 benchmark explain itself',
    (_id, target) => {
      for (const benchmark of target.phase1Benchmarks) {
        expect(benchmark.rationale.length).toBeGreaterThan(20);
        expect(benchmark.target).toBeGreaterThan(0);
      }
    },
  );

  // Structural, not cosmetic: the two carry different field names so neither
  // can be rendered through the other's code path.
  it.each(TARGETS.map((t) => [t.id, t] as const))(
    '%s keeps benchmarks and standards structurally distinct',
    (_id, target) => {
      for (const benchmark of target.phase1Benchmarks) {
        expect('requirement' in benchmark).toBe(false);
      }
      for (const standard of target.officialStandards) {
        expect('target' in standard).toBe(false);
      }
    },
  );
});

describe('water safety', () => {
  const water = findDomain(PARARESCUE, 'water_confidence');

  it('is a first-class domain, separate from swimming', () => {
    expect(water).toBeDefined();
    expect(findDomain(PARARESCUE, 'swimming')).toBeDefined();
    expect(preparationDomain('water_confidence').measurement).toBe('proficiency');
  });

  it('gives every water skill a safety notice', () => {
    for (const skill of water?.proficiencySkills ?? []) {
      expect(skill.safetyNotice).toBeDefined();
      expect((skill.safetyNotice ?? '').length).toBeGreaterThan(20);
    }
  });

  // The one that could actually kill someone.
  it('requires supervision for underwater work and warns about blackout', () => {
    const underwater = water?.proficiencySkills?.find((s) => s.id === 'underwater_comfort');
    expect(underwater).toBeDefined();
    expect(underwater?.requiresSupervision).toBe(true);
    expect(underwater?.safetyNotice?.toLowerCase()).toContain('blackout');
    expect(underwater?.safetyNotice?.toLowerCase()).toContain('never');
  });

  it('states plainly that breath-hold performance is never measured', () => {
    const article = PARARESCUE.intel.find((a) => a.id === 'water_safety');
    expect(article).toBeDefined();
    const text = (article?.body ?? []).join(' ').toLowerCase();
    expect(text).toContain('breath-hold');
    expect(text).toMatch(/does not measure|never/);
  });

  it('defines no breath-hold or underwater-distance assessment', () => {
    for (const target of TARGETS) {
      for (const assessment of target.assessments) {
        expect(assessment.eventId).not.toMatch(/breath|hold|underwater/i);
      }
      for (const benchmark of target.phase1Benchmarks) {
        expect(benchmark.eventId).not.toMatch(/breath|hold|underwater/i);
      }
    }
  });
});

describe('strength stays unscored until it can be measured safely', () => {
  it('is a domain with no assessment events', () => {
    const strength = findDomain(PARARESCUE, 'strength');
    expect(strength).toBeDefined();
    expect(strength?.eventIds).toHaveLength(0);
  });

  it('says why in its rationale', () => {
    const strength = findDomain(PARARESCUE, 'strength');
    expect(strength?.rationale.toLowerCase()).toContain('maximal');
  });
});

describe('pararescue weighting reflects the career', () => {
  it('weights water most heavily overall', () => {
    const swimming = findDomain(PARARESCUE, 'swimming')?.weight ?? 0;
    const water = findDomain(PARARESCUE, 'water_confidence')?.weight ?? 0;
    const running = findDomain(PARARESCUE, 'running')?.weight ?? 0;
    expect(swimming + water).toBeGreaterThan(running * 2);
  });

  it('marks swimming and water confidence as the highest demands', () => {
    expect(findDomain(PARARESCUE, 'swimming')?.demand).toBe('very_high');
    expect(findDomain(PARARESCUE, 'water_confidence')?.demand).toBe('very_high');
  });
});

describe('milestones are personal, not official process', () => {
  it('gives each a unique id and a distinct order', () => {
    const ids = PARARESCUE.milestones.map((m) => m.id);
    const orders = PARARESCUE.milestones.map((m) => m.order);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('describes each in terms of what the athlete has done', () => {
    for (const milestone of PARARESCUE.milestones) {
      expect(milestone.description.length).toBeGreaterThan(10);
    }
  });
});
