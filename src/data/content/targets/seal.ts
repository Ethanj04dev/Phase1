import { unverified } from '@/domain/target/provenance';
import type {
  MilestoneDefinition,
  OfficialStandard,
  Phase1Benchmark,
  PipelineStage,
  TargetDefinition,
  TargetDomain,
} from '@/domain/target/types';

import { WATER_CONFIDENCE_SKILLS, WATER_SAFETY_ARTICLE } from './waterConfidenceSkills';

/**
 * Navy SEAL — the third Target, and the swim-dominant profile.
 *
 * Pararescue proved the model, Ranger proved the no-water path; this one
 * proves that two water careers can weight the same domains differently and
 * share one set of water-confidence skills — which matters because the safety
 * notices in that set are the most important prose in the product, and they
 * must never fork.
 *
 * Same rules as everywhere: every official figure is `unverified` until a
 * human cites an authoritative document, and everything authored here is
 * Zero Phase's own preparation judgement, labelled as exactly that.
 */

// --- Preparation domains ----------------------------------------------------
//
// Swim-dominant: the water carries more combined weight than for any other
// Target, and calisthenics sits higher than for Pararescue. Weights sum to 1
// and are Zero Phase's judgement, not a published weighting.

const domains: readonly TargetDomain[] = [
  {
    id: 'swimming',
    weight: 0.26,
    demand: 'very_high',
    rationale:
      'The single fitness this preparation cannot compromise on. Swim capacity is tested early, leaned on daily, and slow to build.',
    eventIds: ['swim_500m'],
  },
  {
    id: 'water_confidence',
    weight: 0.18,
    demand: 'very_high',
    rationale:
      'Being fit in the water and being comfortable in it are different things. Comfort is trainable, and it is usually the difference between performing and panicking.',
    eventIds: [],
    proficiencySkills: WATER_CONFIDENCE_SKILLS,
  },
  {
    id: 'calisthenics',
    weight: 0.18,
    demand: 'very_high',
    rationale:
      'High-repetition body-weight work is tested directly and repeated relentlessly. The bar is higher here than for any other domain of its kind.',
    eventIds: ['pull_ups', 'push_ups', 'sit_ups'],
  },
  {
    id: 'running',
    weight: 0.16,
    demand: 'high',
    rationale:
      'Aerobic capacity underwrites everything else, on sand as much as on a track.',
    eventIds: ['run_1_mile', 'run_1_5_mile'],
  },
  {
    id: 'rucking',
    weight: 0.08,
    demand: 'moderate',
    rationale:
      'Load carriage matters, but for this preparation it follows water and running rather than leading them.',
    eventIds: ['ruck_3_mile'],
  },
  {
    id: 'strength',
    weight: 0.06,
    demand: 'moderate',
    rationale:
      'Enough usable strength to carry, climb and move load. Zero Phase does not score this from a maximal lift, so it stays unscored until a safe submaximal assessment exists.',
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
// All unverified, deliberately: this career publishes an entry test, but its
// current figures have not been sourced from an authoritative document, and a
// plausible number is worse than an empty field.

const officialStandards: readonly OfficialStandard[] = [
  { eventId: 'swim_500m', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'push_ups', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'sit_ups', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'pull_ups', requirement: unverified('Not yet sourced from an authoritative document.') },
  { eventId: 'run_1_5_mile', requirement: unverified('Not yet sourced from an authoritative document.') },
];

// --- Zero Phase benchmarks -----------------------------------------------------

const phase1Benchmarks: readonly Phase1Benchmark[] = [
  {
    eventId: 'swim_500m',
    target: 540,
    rationale:
      'Nine minutes flat with capacity left over. For a swim-dominant preparation the benchmark leads the field, and it is the hardest one here on purpose.',
  },
  {
    eventId: 'pull_ups',
    target: 18,
    rationale: 'Pulling reserve for a preparation that tests calisthenics relentlessly.',
  },
  {
    eventId: 'push_ups',
    target: 80,
    rationale: 'Pushing endurance that holds up across repeated tests, not just one.',
  },
  {
    eventId: 'sit_ups',
    target: 80,
    rationale: 'Trunk endurance sufficient to protect the back under load and in the water.',
  },
  {
    eventId: 'run_1_5_mile',
    target: 570,
    rationale:
      'A 9:30 indicates the aerobic base needed to absorb the running volume without breaking down.',
  },
  {
    eventId: 'run_1_mile',
    target: 390,
    rationale: 'Supports interval work at the paces the programme prescribes.',
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
// Structure only, as for every Target: naming a real stage is itself a claim,
// and this career's pipeline has not been sourced yet.

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
    emphasis: ['swimming', 'water_confidence', 'calisthenics'],
    isPlaceholder: true,
  },
  {
    id: 'selection',
    name: 'Selection / Assessment',
    summary: 'The assessment phase that determines progression.',
    emphasis: ['water_confidence', 'swimming', 'running'],
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
    description: 'You have recorded a full baseline in Zero Phase.',
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

// --- The definition ---------------------------------------------------------

export const SEAL: TargetDefinition = {
  id: 'navy_seal',
  name: 'Navy SEAL',
  shortName: 'SEAL',
  branch: 'navy',
  category: 'Naval Special Warfare',
  description:
    'A swim-dominant pipeline where water fitness, water comfort and relentless calisthenics carry the preparation, with running close behind.',
  domains,
  officialStandards,
  phase1Benchmarks,
  assessments: [
    // Every assessment is a Zero Phase measure. Marking one "official" is itself
    // a claim about how this career tests candidates, and that has not been
    // sourced.
    { eventId: 'swim_500m', origin: 'phase1', domainId: 'swimming' },
    { eventId: 'pull_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'push_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'sit_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'run_1_5_mile', origin: 'phase1', domainId: 'running' },
    { eventId: 'run_1_mile', origin: 'phase1', domainId: 'running' },
    { eventId: 'ruck_3_mile', origin: 'phase1', domainId: 'rucking' },
  ],
  pipeline,
  milestones,
  intel: [
    {
      id: 'preparation_approach',
      category: 'preparation',
      title: 'How Zero Phase approaches this Target',
      body: [
        'Zero Phase weights the water most heavily for this career — swimming fitness and water confidence together carry more of the score than for any other Target — with calisthenics and running close behind.',
        'That weighting is Zero Phase’s own judgement about where preparation time pays off. It is not a published or official weighting, and it is visible so you can disagree with it.',
        'Your readiness score measures you against Zero Phase benchmarks only. It is not a prediction, and it does not guarantee selection.',
      ],
    },
    WATER_SAFETY_ARTICLE,
    {
      id: 'standards_pending',
      category: 'fitness',
      title: 'Why some standards are blank',
      body: [
        'Official entry standards for this career field have not yet been sourced from an authoritative document, so Zero Phase shows them as requiring verification rather than filling them in with a plausible number.',
        'The figures you do see are Zero Phase preparation benchmarks, labelled as such, with the reasoning behind each one.',
        'Confirm current official requirements with a recruiter or an official source.',
      ],
    },
  ],
  sources: [],
};
