/**
 * Every user-visible brand string lives here.
 *
 * Domain code (readiness, programming, assessments) must never reference
 * "Phase 1" — it deals in `athlete`, `program`, `assessment`, `readiness`.
 * That separation is what makes a white-label or partner build a config
 * change rather than a refactor.
 */
export const branding = {
  productName: 'PHASE 1',
  /** Split wordmark so the numeral can be styled in the accent colour. */
  wordmark: {
    lead: 'PHASE',
    numeral: '1',
  },
  tagline: 'Prepare for what comes next.',
  /** Short form used in dense headers and tab bars. */
  shortName: 'P1',
  supportEmail: 'support@example.com',
} as const;

/**
 * The phase ladder is a *presentation* concept layered over readiness score
 * bands. The MVP only ever displays Phase 01, but the ladder is defined now
 * so the progression can be switched on later without a data migration.
 */
export interface PhaseDefinition {
  id: number;
  code: string;
  name: string;
  /** Inclusive lower bound of the readiness band that unlocks this phase. */
  minReadiness: number;
}

export const PHASES: readonly PhaseDefinition[] = [
  { id: 1, code: 'PHASE 01', name: 'Foundation', minReadiness: 0 },
  { id: 2, code: 'PHASE 02', name: 'Development', minReadiness: 55 },
  { id: 3, code: 'PHASE 03', name: 'Preparation', minReadiness: 75 },
  { id: 4, code: 'PHASE 04', name: 'Selection Ready', minReadiness: 90 },
] as const;

export function phaseForReadiness(readiness: number): PhaseDefinition {
  // Walk from the top so the highest satisfied band wins.
  for (let i = PHASES.length - 1; i >= 0; i -= 1) {
    const phase = PHASES[i];
    if (phase && readiness >= phase.minReadiness) {
      return phase;
    }
  }
  // PHASES is non-empty and its first band starts at 0, so this is unreachable
  // in practice; the throw keeps the return type non-nullable.
  throw new Error('PHASES must define a band starting at 0');
}
