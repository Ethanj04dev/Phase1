/** Formatting helpers. Pure functions, no React, trivially testable. */

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

/** Operational date stamp, e.g. "AUG 25". */
export function formatDateStamp(date: Date): string {
  const month = MONTHS[date.getMonth()] ?? '---';
  return `${month} ${String(date.getDate()).padStart(2, '0')}`;
}

/** Zero-padded position label, e.g. "WEEK 04". */
export function formatPosition(label: string, value: number): string {
  return `${label} ${String(value).padStart(2, '0')}`;
}

/**
 * Clock format for durations. Under an hour reads "9:28"; an hour or more
 * reads "1:04:12". Negative or non-finite input renders as a dash placeholder.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '--:--';
  }

  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Renders a target window, e.g. "3:20-3:30". */
export function formatDurationRange(lowSeconds: number, highSeconds: number): string {
  return `${formatDuration(lowSeconds)}-${formatDuration(highSeconds)}`;
}

/** Distance in metres rendered for a US audience. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '--';
  }
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  const miles = meters / 1609.344;
  // Whole-mile distances are common in programming; avoid "3.0 mi".
  const rounded = Math.round(miles * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} mi`;
}

/** Percentage for progress copy, e.g. "60%". */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) {
    return '--';
  }
  return `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
}
