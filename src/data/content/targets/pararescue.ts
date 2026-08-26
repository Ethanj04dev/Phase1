import { unverified } from '@/domain/target/provenance';
import type {
  MilestoneDefinition,
  OfficialStandard,
  Phase1Benchmark,
  PipelineStage,
  TargetDefinition,
  TargetDomain,
} from '@/domain/target/types';

/**
 * Pararescue — the first fully modelled Target.
 *
 * Read this before editing:
 *
 * Every official figure here is `unverified`. That is not an oversight and not
 * a TODO to fill in with something plausible. Phase 1's entire credibility
 * rests on never presenting its own recommendation as a military requirement,
 * so an unsourced standard shows as "Verification required" until somebody
 * reads an authoritative document and cites it.
 *
 * What *is* authored here is Phase 1's own preparation methodology: which
 * domains matter and how much, what Phase 1 thinks an athlete should be able
 * to do to arrive prepared rather than merely eligible, and why. All of it is
 * labelled as Phase 1's opinion, because that is what it is.
 */

// --- Preparation domains ----------------------------------------------------
//
// Weights sum to 1 and are Phase 1's judgement about where preparation time
// pays off for this career, not a published weighting.

const domains: readonly TargetDomain[] = [
  {
    id: 'swimming',
    weight: 0.22,
    demand: 'very_high',
    rationale:
      'Water is the environment that most often ends a candidate early. Swimming fitness is the base everything else in the water is built on.',
    eventIds: ['swim_500m'],
  },
  {
    id: 'water_confidence',
    weight: 0.2,
    demand: 'very_high',
    rationale:
      'Being fit in the water and being comfortable in it are different things. Comfort is trainable, and it is usually the difference between performing and panicking.',
    eventIds: [],
    proficiencySkills: [
      {
        id: 'treading',
        label: 'Treading',
        description:
          'Staying comfortably afloat without using the hands, for progressively longer periods.',
        phase1Target: 'competent',
        requiresSupervision: false,
        safetyNotice: 'Never train in water alone, even for surface work.',
      },
      {
        id: 'fin_swimming',
        label: 'Fin swimming',
        description: 'Efficient surface and sub-surface movement wearing fins.',
        phase1Target: 'competent',
        requiresSupervision: false,
        safetyNotice: 'Never train in water alone, even for surface work.',
      },
      {
        id: 'mask_snorkel',
        label: 'Mask and snorkel',
        description: 'Clearing, breathing and moving comfortably with a mask and snorkel.',
        phase1Target: 'competent',
        requiresSupervision: false,
        safetyNotice: 'Never train in water alone, even for surface work.',
      },
      {
        id: 'equipment_comfort',
        label: 'Equipment familiarity',
        description:
          'Handling and adjusting equipment in the water without it raising your stress level.',
        phase1Target: 'developing',
        requiresSupervision: false,
        safetyNotice: 'Never train in water alone, even for surface work.',
      },
      {
        // The only skill here that can kill someone practising it wrongly.
        id: 'underwater_comfort',
        label: 'Underwater comfort',
        description:
          'Being calm and controlled below the surface during short, supervised skill work.',
        phase1Target: 'developing',
        requiresSupervision: true,
        safetyNotice:
          'Requires qualified in-water supervision. Never practise breath-holding or underwater work alone. Hyperventilating before going under, or pushing to your limit, can cause blackout without warning and drowning follows silently. Phase 1 does not measure or reward breath-hold performance.',
      },
    ],
  },
  {
    id: 'running',
    weight: 0.18,
    demand: 'high',
    rationale:
      'Aerobic capacity underwrites everything else and recovers slowest if neglected.',
    eventIds: ['run_1_mile', 'run_1_5_mile'],
  },
  {
    id: 'calisthenics',
    weight: 0.15,
    demand: 'high',
    rationale:
      'Repeatable body-weight strength endurance, tested directly and relied on constantly.',
    eventIds: ['pull_ups', 'push_ups', 'sit_ups'],
  },
  {
    id: 'rucking',
    weight: 0.1,
    demand: 'high',
    rationale:
      'Moving under load is a durability problem as much as a fitness one, and the adaptation is slow.',
    eventIds: ['ruck_3_mile'],
  },
  {
    id: 'strength',
    weight: 0.07,
    demand: 'moderate',
    rationale:
      'Enough usable strength to carry, climb and move load. Phase 1 does not score this from a maximal lift, so it stays unscored until a safe submaximal assessment exists.',
    // Deliberately empty. A domain with no safe assessment carries no score
    // rather than an invented one.
    eventIds: [],
  },
  {
    id: 'training_consistency',
    weight: 0.08,
    demand: 'high',
    rationale:
      'The plan only works if it is followed. Consistency is the one domain entirely within the athlete’s control.',
    eventIds: [],
  },
];

// --- Official standards -----------------------------------------------------
//
// All unverified, deliberately. See the note at the top of this file.

const officialStandards: readonly OfficialStandard[] = [
  { eventId: 'pull_ups', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'push_ups', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'sit_ups', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'run_1_5_mile', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'swim_500m', requirement: unverified('Not yet sourced from an authoritative document.') },
];

// --- Phase 1 benchmarks -----------------------------------------------------
//
// Phase 1's own preparation targets. Explicitly not requirements: they are
// where Phase 1 thinks an athlete should be to arrive prepared rather than
// merely eligible.

const phase1Benchmarks: readonly Phase1Benchmark[] = [
  {
    eventId: 'swim_500m',
    target: 570,
    rationale:
      'Comfortably inside ten minutes leaves capacity for skill work afterwards, rather than arriving at it already spent.',
  },
  {
    eventId: 'run_1_5_mile',
    target: 570,
    rationale:
      'A 9:30 here indicates the aerobic base needed to absorb the running volume without breaking down.',
  },
  {
    eventId: 'run_1_mile',
    target: 390,
    rationale: 'Supports interval work at the paces the programme prescribes.',
  },
  {
    eventId: 'pull_ups',
    target: 20,
    rationale: 'Enough pulling reserve that upper-body work is not the limiting factor.',
  },
  {
    eventId: 'push_ups',
    target: 75,
    rationale: 'Pushing endurance that holds up late in a session rather than early.',
  },
  {
    eventId: 'sit_ups',
    target: 80,
    rationale: 'Trunk endurance sufficient to protect the back under load.',
  },
  {
    eventId: 'ruck_3_mile',
    target: 2520,
    rationale:
      'A 14:00 per mile pace under load is a sustainable working pace rather than a time trial.',
  },
];

// --- Pipeline ---------------------------------------------------------------
//
// Structure only. Every stage is a placeholder: naming a real stage is itself
// a claim, and this career's pipeline has not been sourced yet.

const pipeline: readonly PipelineStage[] = [
  {
    id: 'entry',
    name: 'Entry',
    summary: 'Enlistment and initial processing before any specialty training begins.',
    emphasis: ['training_consistency'],
    isPlaceholder: true,
  },
  {
    id: 'initial_training',
    name: 'Initial Training',
    summary: 'Basic military training common to all entrants.',
    emphasis: ['running', 'calisthenics'],
    isPlaceholder: true,
  },
  {
    id: 'preparatory',
    name: 'Preparatory Stage',
    summary: 'Physical and technical preparation ahead of selection.',
    emphasis: ['swimming', 'water_confidence', 'running'],
    isPlaceholder: true,
  },
  {
    id: 'selection',
    name: 'Selection / Assessment',
    summary: 'The assessment phase that determines progression.',
    emphasis: ['water_confidence', 'swimming', 'rucking'],
    isPlaceholder: true,
  },
  {
    id: 'specialty',
    name: 'Specialty Training',
    summary: 'Career-specific technical training.',
    emphasis: ['durability'],
    isPlaceholder: true,
  },
  {
    id: 'qualification',
    name: 'Qualification',
    summary: 'Completion and award of the specialty.',
    emphasis: [],
    isPlaceholder: true,
  },
];

// --- Milestones -------------------------------------------------------------
//
// Personal admin the athlete tracks for themselves. Not official process
// guidance, and deliberately optional: candidates arrive by different routes.

const milestones: readonly MilestoneDefinition[] = [
  {
    id: 'recruiter_contacted',
    label: 'Recruiter contacted',
    description: 'You have spoken to a recruiter about this career field.',
    order: 1,
  },
  {
    id: 'asvab_completed',
    label: 'ASVAB completed',
    description: 'You have sat the ASVAB.',
    order: 2,
  },
  {
    id: 'meps_completed',
    label: 'MEPS completed',
    description: 'You have completed processing at MEPS.',
    order: 3,
  },
  {
    id: 'first_assessment',
    label: 'First fitness assessment',
    description: 'You have recorded a full baseline in Phase 1.',
    order: 4,
  },
  {
    id: 'contract_secured',
    label: 'Contract secured',
    description: 'You hold a contract for this career field.',
    order: 5,
  },
  {
    id: 'ship_date',
    label: 'Ship date set',
    description: 'You have a date to report.',
    order: 6,
  },
];

export const PARARESCUE: TargetDefinition = {
  id: 'pararescue',
  name: 'Pararescue',
  shortName: 'PJ',
  branch: 'air_force',
  category: 'Air Force Special Warfare',
  description:
    'A water-heavy pipeline that demands swimming fitness, genuine comfort in the water, and the aerobic base to carry both.',
  domains,
  officialStandards,
  phase1Benchmarks,
  assessments: [
    // Every assessment is currently a Phase 1 measure. Marking one "official"
    // is itself a claim about how this career tests candidates, and that has
    // not been sourced.
    { eventId: 'swim_500m', origin: 'phase1', domainId: 'swimming' },
    { eventId: 'run_1_5_mile', origin: 'phase1', domainId: 'running' },
    { eventId: 'run_1_mile', origin: 'phase1', domainId: 'running' },
    { eventId: 'pull_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'push_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'sit_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'ruck_3_mile', origin: 'phase1', domainId: 'rucking' },
  ],
  pipeline,
  milestones,
  intel: [
    {
      id: 'preparation_approach',
      category: 'preparation',
      title: 'How Phase 1 approaches this Target',
      body: [
        'Phase 1 weights swimming and water confidence most heavily for this career, then running, then body-weight strength endurance and load carriage.',
        'That weighting is Phase 1’s own judgement about where preparation time pays off. It is not a published or official weighting, and it is visible so you can disagree with it.',
        'Your readiness score measures you against Phase 1 benchmarks only. It is not a prediction, and it does not guarantee selection.',
      ],
    },
    {
      id: 'water_safety',
      category: 'preparation',
      title: 'Water and underwater work',
      body: [
        'Never train in water alone. That applies to easy surface swimming as much as to skill work.',
        'Any underwater or breath-holding practice requires qualified in-water supervision. Hyperventilating beforehand, or pushing to your limit, can cause blackout with no warning, and drowning follows silently.',
        'Phase 1 does not measure, rank or reward breath-hold performance, and never will. Water confidence here means being calm and capable, not proving how long you can stay under.',
      ],
    },
    {
      id: 'standards_pending',
      category: 'fitness',
      title: 'Why some standards are blank',
      body: [
        'Official entry standards for this career field have not yet been sourced from an authoritative document, so Phase 1 shows them as requiring verification rather than filling them in with a plausible number.',
        'A wrong official figure is worse than a missing one: you would train to it, and find out at the worst possible moment.',
        'Phase 1 targets are shown alongside and are clearly labelled. They are preparation benchmarks written by Phase 1, not requirements.',
      ],
    },
    {
      id: 'pipeline_pending',
      category: 'pipeline',
      title: 'Why the pipeline is generic',
      body: [
        'The stages shown are generic structure, not this career’s actual pipeline. Naming a real stage is a claim, and that claim has not been verified.',
        'Treat it as a shape to orient by, and confirm the specifics with a recruiter or an official source.',
      ],
    },
  ],
  // Nothing verified yet, so nothing to cite. This grows as standards are
  // sourced, and every verified figure must point at an entry here.
  sources: [],
};
