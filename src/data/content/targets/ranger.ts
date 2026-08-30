import type {
  MilestoneDefinition,
  PipelineStage,
  Phase1Benchmark,
  TargetDefinition,
  TargetDomain,
} from '@/domain/target/types';

/**
 * Army Ranger — the second Target, and the proof of the model.
 *
 * The architecture's promise is that adding a career means writing a
 * definition, not editing the application. This file is that promise being
 * kept: no swimming domain, no water confidence, a different weighting, and
 * every screen from the gauge to Road to Ready simply follows.
 *
 * Same rules as Pararescue. Nothing official is asserted: this career's
 * standards have not been sourced, so there are no official standard entries
 * at all — which the Fitness screen reports as "no official standard on
 * file", a different and truer claim than "verification required". The
 * weights, benchmarks and rationale are Zero Phase's own preparation judgement,
 * labelled as exactly that.
 */

// --- Preparation domains ----------------------------------------------------
//
// Load carriage is the centre of gravity, with running a close second. No
// water domains: this preparation lives on foot and under a ruck. Weights sum
// to 1 and are Zero Phase's judgement, not a published weighting.

const domains: readonly TargetDomain[] = [
  {
    id: 'rucking',
    weight: 0.3,
    demand: 'very_high',
    rationale:
      'Moving under load is the defining physical demand of this preparation. It is trained slowly and lost slowly, so it rewards starting early.',
    eventIds: ['ruck_3_mile'],
  },
  {
    id: 'running',
    weight: 0.27,
    demand: 'very_high',
    rationale:
      'Aerobic capacity underwrites every long day, and running fitness converts directly into ruck pace.',
    eventIds: ['run_1_mile', 'run_1_5_mile'],
  },
  {
    id: 'calisthenics',
    weight: 0.2,
    demand: 'high',
    rationale:
      'Body-weight strength endurance is tested early and often, and it is the cheapest fitness to build before arrival.',
    eventIds: ['pull_ups', 'push_ups', 'sit_ups'],
  },
  {
    id: 'strength',
    weight: 0.12,
    demand: 'high',
    rationale:
      'Enough usable strength to carry, drag and lift under fatigue. Zero Phase does not score this from a maximal lift, so it stays unscored until a safe submaximal assessment exists.',
    eventIds: [],
  },
  {
    id: 'training_consistency',
    weight: 0.11,
    demand: 'moderate',
    rationale:
      'The plan only works if it is followed. Consistency is the one domain entirely within the athlete’s control.',
    eventIds: [],
  },
];

// --- Zero Phase benchmarks -----------------------------------------------------
//
// Zero Phase's own preparation targets. Explicitly not requirements: they are
// where Zero Phase thinks an athlete should be to arrive prepared rather than
// merely eligible.

const phase1Benchmarks: readonly Phase1Benchmark[] = [
  {
    eventId: 'ruck_3_mile',
    target: 2340,
    rationale:
      'A 13:00 per mile pace under load, held comfortably. Load carriage is the centre of this preparation and the benchmark reflects that.',
  },
  {
    eventId: 'run_1_5_mile',
    target: 555,
    rationale:
      'A 9:15 indicates the aerobic base to absorb high running volume without breaking down.',
  },
  {
    eventId: 'run_1_mile',
    target: 390,
    rationale: 'Supports interval work at the paces the programme prescribes.',
  },
  {
    eventId: 'pull_ups',
    target: 15,
    rationale: 'Enough pulling reserve that upper-body work is not the limiting factor.',
  },
  {
    eventId: 'push_ups',
    target: 70,
    rationale: 'Pushing endurance that holds up late in a session rather than early.',
  },
  {
    eventId: 'sit_ups',
    target: 75,
    rationale: 'Trunk endurance sufficient to protect the back under load.',
  },
];

// --- Pipeline ---------------------------------------------------------------
//
// Structure only, exactly as for Pararescue: naming a real stage is itself a
// claim, and this career's pipeline has not been sourced yet.

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
    emphasis: ['rucking', 'running'],
    isPlaceholder: true,
  },
  {
    id: 'selection',
    name: 'Selection / Assessment',
    summary: 'The assessment phase that determines progression.',
    emphasis: ['rucking', 'running', 'calisthenics'],
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

export const RANGER: TargetDefinition = {
  id: 'army_ranger',
  name: 'Army Ranger',
  shortName: 'Ranger',
  branch: 'army',
  category: 'Army Special Operations',
  description:
    'A ground-movement pipeline built on load carriage, running volume and body-weight strength endurance, sustained across long days.',
  domains,
  // None sourced yet. An empty list is a different claim from an unverified
  // one: it says no official standard is on file for these events at all,
  // rather than that a known standard awaits a citation.
  officialStandards: [],
  phase1Benchmarks,
  assessments: [
    // Every assessment is a Zero Phase measure. Marking one "official" is itself
    // a claim about how this career tests candidates, and that has not been
    // sourced.
    { eventId: 'ruck_3_mile', origin: 'phase1', domainId: 'rucking' },
    { eventId: 'run_1_5_mile', origin: 'phase1', domainId: 'running' },
    { eventId: 'run_1_mile', origin: 'phase1', domainId: 'running' },
    { eventId: 'pull_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'push_ups', origin: 'phase1', domainId: 'calisthenics' },
    { eventId: 'sit_ups', origin: 'phase1', domainId: 'calisthenics' },
  ],
  pipeline,
  milestones,
  intel: [
    {
      id: 'preparation_approach',
      category: 'preparation',
      title: 'How Zero Phase approaches this Target',
      body: [
        'Zero Phase weights load carriage most heavily for this career, then running, then body-weight strength endurance.',
        'That weighting is Zero Phase’s own judgement about where preparation time pays off. It is not a published or official weighting, and it is visible so you can disagree with it.',
        'Your readiness score measures you against Zero Phase benchmarks only. It is not a prediction, and it does not guarantee selection.',
      ],
    },
    {
      id: 'no_swim',
      category: 'fitness',
      title: 'Why swimming is not scored here',
      body: [
        'This Target’s readiness score contains no swimming or water confidence domains, because Zero Phase weights preparation toward what this pipeline leans on hardest: moving on foot, under load, for a long time.',
        'That does not mean water skills never appear anywhere in a career. It means Zero Phase does not score them for this Target, and says so rather than quietly averaging them in.',
        'Zero Phase does not measure, rank or reward breath-hold performance for any career, and never will.',
      ],
    },
    {
      id: 'standards_pending',
      category: 'fitness',
      title: 'Why there are no official standards shown',
      body: [
        'No official entry standards for this career field have been sourced from an authoritative document yet, so Zero Phase shows none rather than filling the space with plausible numbers.',
        'The figures you do see are Zero Phase preparation benchmarks, labelled as such, with the reasoning behind each one.',
        'Confirm current official requirements with a recruiter or an official source.',
      ],
    },
    {
      id: 'consistency',
      category: 'preparation',
      title: 'The quiet variable',
      body: [
        'Rucking and running volume reward monotony. The athletes who arrive prepared are rarely the ones with the most impressive single sessions; they are the ones who did not miss weeks.',
        'Zero Phase scores training consistency for this Target because for this preparation it is a fitness input, not an attitude badge.',
      ],
    },
  ],
  sources: [],
};
