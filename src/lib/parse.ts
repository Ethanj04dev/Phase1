/**
 * Parsers for athlete-entered values. Pure, and strict on purpose: a
 * misparsed baseline silently corrupts every readiness score that follows.
 */

const MAX_REPS = 999;
const MAX_DURATION_SECONDS = 24 * 60 * 60;

/**
 * Parses a clock-style duration into seconds.
 *
 * A colon is required. A bare "930" is rejected rather than guessed at,
 * because an athlete meaning 9:30 would otherwise silently record 15 minutes
 * 30 seconds and score far worse than they ran.
 *
 * Accepts `m:ss`, `mm:ss` and `h:mm:ss`. Seconds and minutes must be two
 * digits when they follow a colon, so "9:5" is rejected as ambiguous.
 */
export function parseDurationInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, first, second, third] = match;
  if (first === undefined || second === undefined) {
    return null;
  }

  const total =
    third === undefined
      ? Number(first) * 60 + Number(second)
      : Number(first) * 3600 + Number(second) * 60 + Number(third);

  if (total <= 0 || total > MAX_DURATION_SECONDS) {
    return null;
  }
  return total;
}

/**
 * Parses a repetition count. Whole non-negative numbers only; zero is a valid
 * honest answer for an athlete who cannot yet do a single pull-up.
 */
export function parseRepsInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!/^\d{1,3}$/.test(trimmed)) {
    return null;
  }

  const value = Number(trimmed);
  return value <= MAX_REPS ? value : null;
}

/** Formats seconds back into the clock form the duration parser accepts. */
export function toDurationInput(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '';
  }
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}
