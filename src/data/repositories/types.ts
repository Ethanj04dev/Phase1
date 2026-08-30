import type { AssessmentEventId, AssessmentResult } from '@/domain/assessment/types';
import type { AthleteProfile } from '@/domain/athlete/types';
import type { AssessmentAttempt } from '@/domain/attempt/types';
import type { CandidateProfile } from '@/domain/candidate/types';
import type { MilestoneCompletion } from '@/domain/pipeline/milestones';
import type {
  NewProficiencyRating,
  ProficiencyRating,
} from '@/domain/pipeline/proficiency';
import type {
  ReadinessCalculation,
  ReadinessSnapshot,
  ReadinessTrend,
} from '@/domain/readiness/types';
import type {
  ActiveSession,
  ExerciseResult,
  Program,
  ResolvedWorkoutDay,
  WorkoutResult,
} from '@/domain/training/types';
import type {
  SessionEventClaim,
  TimelineEntry,
  VerificationSession,
  VerificationVerdict,
} from '@/domain/verification/types';
import type { IsoDate, IsoDateTime, Result, Uuid } from '@/domain/types';

/**
 * Repository interfaces are the seam between the UI and wherever data
 * actually lives. Screens depend on these types only, so the mock
 * implementation can be replaced by Supabase without touching a component.
 *
 * Every method returns a Result rather than throwing, which forces each call
 * site to handle the failure path explicitly.
 */

/** Fields onboarding supplies. Identity and timestamps are the repository's job. */
export type NewAthleteProfile = Omit<
  AthleteProfile,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

export interface AthleteRepository {
  getCurrentProfile(): Promise<Result<AthleteProfile | null>>;
  createProfile(input: NewAthleteProfile): Promise<Result<AthleteProfile>>;
  updateProfile(
    id: Uuid,
    patch: Partial<Omit<AthleteProfile, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<Result<AthleteProfile>>;
}

/** Fields identity setup supplies. Ids and timestamps are the repository's job. */
export type NewCandidateProfile = Omit<
  CandidateProfile,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

/**
 * The candidate's competitive identity, separate from the athlete's training
 * configuration on purpose: the two change for different reasons and carry
 * different privacy rules.
 */
export interface CandidateRepository {
  getMine(): Promise<Result<CandidateProfile | null>>;
  /**
   * Claims a handle and creates the profile. Fails with code 'conflict' when
   * the handle was taken between the availability check and the write —
   * uniqueness is enforced where the data lives, not in the UI.
   */
  create(input: NewCandidateProfile): Promise<Result<CandidateProfile>>;
  update(
    id: Uuid,
    patch: Partial<Omit<CandidateProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Result<CandidateProfile>>;
  /**
   * Whether a normalized handle is free to claim. Advisory only — the answer
   * can go stale before create() runs, which is why create() can conflict.
   */
  isHandleAvailable(handle: string): Promise<Result<boolean>>;
}

export interface ReadinessRepository {
  getLatest(athleteId: Uuid): Promise<Result<ReadinessSnapshot | null>>;
  getTrend(athleteId: Uuid, windowDays: number): Promise<Result<ReadinessTrend | null>>;
  /** Newest first. Paged so history never loads in full. */
  listHistory(
    athleteId: Uuid,
    options?: { limit?: number; before?: IsoDate },
  ): Promise<Result<readonly ReadinessSnapshot[]>>;
  /**
   * Appends a snapshot. Takes a finished calculation rather than raw results:
   * scoring is the domain layer's job, storage is the repository's.
   */
  record(
    athleteId: Uuid,
    calculation: ReadinessCalculation,
  ): Promise<Result<ReadinessSnapshot>>;
}

export interface ProgramPosition {
  weekNumber: number;
  dayNumber: number;
  weekFocus: string;
}

/** The athlete's programme with enough metadata to render a week selector. */
export interface ProgramSummary {
  program: Program;
  /** Week number to editorial focus. */
  weekFocus: ReadonlyMap<number, string>;
}

export interface TrainingRepository {
  getToday(athleteId: Uuid): Promise<Result<ResolvedWorkoutDay | null>>;
  getPosition(athleteId: Uuid): Promise<Result<ProgramPosition | null>>;
  getProgram(athleteId: Uuid): Promise<Result<ProgramSummary | null>>;
  /** Every day of one programme week, in order. */
  getWeek(athleteId: Uuid, weekNumber: number): Promise<Result<readonly ResolvedWorkoutDay[]>>;
  getDay(athleteId: Uuid, dayId: string): Promise<Result<ResolvedWorkoutDay | null>>;
  /** Fraction of this week completed, 0-1. */
  getWeeklyCompletion(athleteId: Uuid): Promise<Result<number>>;
  getStreakDays(athleteId: Uuid): Promise<Result<number>>;
}

export interface AssessmentRepository {
  /**
   * Every recorded performance for the athlete. Append-only history, so this
   * grows without bound and gains paging options before it reaches the UI in
   * anger.
   */
  listResults(
    athleteId: Uuid,
    options?: { limit?: number; before?: IsoDate },
  ): Promise<Result<readonly AssessmentResult[]>>;
  /**
   * Appends a batch of results recorded at the same sitting. A batch rather
   * than one call per event, so a baseline test is a single atomic write and
   * cannot half-succeed.
   */
  recordResults(
    athleteId: Uuid,
    entries: readonly NewAssessmentResult[],
  ): Promise<Result<readonly AssessmentResult[]>>;
}

/** One measured performance, before it has an id or a timestamp. */
export interface NewAssessmentResult {
  eventId: AssessmentEventId;
  value: number;
  notes?: string | null;
}

/**
 * What the client may claim about an assessment attempt — and nothing more.
 *
 * There is deliberately no verification status, no verified timestamp and no
 * official rating in this type. The client submits performances; the server
 * decides truth. Every implementation stamps new attempts 'self_reported',
 * and the database refuses inserts that claim otherwise.
 */
export type NewAssessmentAttempt = Omit<
  AssessmentAttempt,
  | 'id'
  | 'athleteId'
  | 'createdAt'
  | 'submittedAt'
  | 'verifiedAt'
  | 'verificationStatus'
  | 'verificationMethod'
  | 'officialRating'
>;

/**
 * Complete assessment attempts: the competitive record.
 *
 * Append-only, like results — a candidate's history of attempts is the
 * product, and nothing here updates or deletes past performances. Server-side
 * verification (M3) transitions attempts through statuses; the client-facing
 * repository can only create self-reported ones and read them back.
 */
export interface AttemptRepository {
  /** Newest first by when the assessment was performed. */
  list(
    athleteId: Uuid,
    options?: { limit?: number },
  ): Promise<Result<readonly AssessmentAttempt[]>>;
  get(athleteId: Uuid, attemptId: Uuid): Promise<Result<AssessmentAttempt | null>>;
  record(athleteId: Uuid, input: NewAssessmentAttempt): Promise<Result<AssessmentAttempt>>;
}

/**
 * Self-assessed skill levels, for domains that cannot be timed or counted.
 *
 * Separate from AssessmentRepository rather than folded into it, because the
 * two store different things: one is a measured performance, the other is the
 * athlete's own judgement. Sharing a table would eventually mean sharing a
 * screen, and a self-rating must never be presented as a test result.
 */
export interface ProficiencyRepository {
  /** Full append-only history, newest first. */
  listRatings(
    athleteId: Uuid,
    options?: { limit?: number },
  ): Promise<Result<readonly ProficiencyRating[]>>;
  /** Appends a batch rated at the same sitting. */
  recordRatings(
    athleteId: Uuid,
    entries: readonly NewProficiencyRating[],
  ): Promise<Result<readonly ProficiencyRating[]>>;
}

/**
 * The athlete's own preparation checklist.
 *
 * A toggle rather than an append-only log, because a milestone is a current
 * fact about someone's life, not a performance history. Marking one undone
 * deletes the row: there is nothing worth keeping about a step someone has
 * told us they did not actually take.
 */
export interface MilestoneRepository {
  listCompletions(athleteId: Uuid): Promise<Result<readonly MilestoneCompletion[]>>;
  /** Idempotent in both directions, so a double tap cannot create two rows. */
  setCompleted(
    athleteId: Uuid,
    milestoneId: string,
    completed: boolean,
  ): Promise<Result<void>>;
}

export interface WorkoutRepository {
  /**
   * The single session in progress, if any.
   *
   * There is deliberately at most one: an athlete is doing one workout at a
   * time, and allowing several would mean reconciling conflicting timers.
   */
  getActive(athleteId: Uuid): Promise<Result<ActiveSession | null>>;
  /** Persists the whole session. Called on every change, not just at the end. */
  saveActive(session: ActiveSession): Promise<Result<ActiveSession>>;
  discardActive(athleteId: Uuid): Promise<Result<void>>;
  /** Writes the finished session and its per-rep rows, then clears the draft. */
  complete(session: ActiveSession, durationSeconds: number): Promise<Result<WorkoutResult>>;
  listResults(
    athleteId: Uuid,
    options?: { limit?: number },
  ): Promise<Result<readonly WorkoutResult[]>>;
  listExerciseResults(workoutResultId: Uuid): Promise<Result<readonly ExerciseResult[]>>;
}

/** What commit_evidence returns: the ledger row id for the later upload. */
export interface CommittedEvidence {
  evidenceId: Uuid;
}

export interface ReviewQueueItem {
  attemptId: Uuid;
  definitionId: string;
  definitionVersion: number;
  pipelineId: string;
  submittedAt: IsoDateTime | null;
}

export interface ReviewEvidenceItem {
  id: Uuid;
  eventId: AssessmentEventId | null;
  kind: 'video' | 'gps_trace';
  storagePath: string | null;
  durationSeconds: number | null;
  receivedAt: IsoDateTime | null;
}

export interface ReviewIntegrityFinding {
  eventId: AssessmentEventId | null;
  verdict: VerificationVerdict | 'uncertain';
  reasonCodes: readonly string[];
}

export interface ReviewEventState {
  eventId: AssessmentEventId;
  claimedValue: number;
  reviewVerdict: VerificationVerdict | null;
  acceptedValue: number | null;
  reasonCode: string | null;
}

export interface ReviewDetail {
  attemptId: Uuid;
  definitionId: string;
  definitionVersion: number;
  verificationStatus: string;
  submittedAt: IsoDateTime | null;
  session: VerificationSession | null;
  timeline: readonly TimelineEntry[];
  claims: readonly SessionEventClaim[];
  evidence: readonly ReviewEvidenceItem[];
  integrity: readonly ReviewIntegrityFinding[];
  events: readonly ReviewEventState[];
}

/**
 * The verified-assessment session flow and the ground-truth console.
 *
 * Online-only by nature: every method is a thin call into SECURITY DEFINER
 * database functions that stamp the server's clock and enforce state. The
 * local implementation refuses politely — a verified performance cannot
 * exist without the server, and pretending otherwise would counterfeit the
 * product's core promise.
 */
export interface VerificationRepository {
  getActiveSession(): Promise<Result<VerificationSession | null>>;
  createSession(
    definitionId: string,
    definitionVersion: number,
    pipelineId: string,
    eventOrder: readonly AssessmentEventId[],
  ): Promise<Result<VerificationSession>>;
  /** Hash first — commits the fingerprint before the bytes move. */
  commitEvidence(
    sessionId: Uuid,
    eventId: AssessmentEventId | null,
    kind: 'video' | 'gps_trace',
    contentHash: string,
    clientCapturedAt: IsoDateTime,
    durationSeconds: number | null,
    byteSize: number,
    mimeType: string,
  ): Promise<Result<CommittedEvidence>>;
  uploadEvidence(
    evidenceId: Uuid,
    sessionId: Uuid,
    localUri: string,
    mimeType: string,
  ): Promise<Result<void>>;
  openEvent(sessionId: Uuid, eventId: AssessmentEventId): Promise<Result<void>>;
  closeEvent(
    sessionId: Uuid,
    eventId: AssessmentEventId,
    claimedValue: number,
  ): Promise<Result<void>>;
  submit(sessionId: Uuid): Promise<Result<Uuid>>;
  abandon(sessionId: Uuid): Promise<Result<void>>;
  getClaims(sessionId: Uuid): Promise<Result<readonly SessionEventClaim[]>>;

  // --- Ground-truth console (reviewer-gated server-side) -------------------
  isReviewer(): Promise<Result<boolean>>;
  listReviewQueue(): Promise<Result<readonly ReviewQueueItem[]>>;
  getReviewDetail(attemptId: Uuid): Promise<Result<ReviewDetail>>;
  getEvidenceUrl(storagePath: string): Promise<Result<string>>;
  reviewEvent(
    attemptId: Uuid,
    eventId: AssessmentEventId,
    verdict: VerificationVerdict,
    acceptedValue: number | null,
    reasonCode: string | null,
    reasonText: string | null,
  ): Promise<Result<void>>;
  finalize(attemptId: Uuid): Promise<Result<string>>;
}

export interface Repositories {
  athlete: AthleteRepository;
  assessment: AssessmentRepository;
  attempt: AttemptRepository;
  candidate: CandidateRepository;
  milestone: MilestoneRepository;
  proficiency: ProficiencyRepository;
  readiness: ReadinessRepository;
  training: TrainingRepository;
  verification: VerificationRepository;
  workout: WorkoutRepository;
}
