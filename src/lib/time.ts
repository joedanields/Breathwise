/** Data older than this (by reading time) is shown as stale (PRD AC4, UI_UX.md §4). */
export const STALE_AFTER_MINUTES = 90;

const MS_PER_MINUTE = 60_000;

/**
 * Open-Meteo returns local times without an offset ("2026-11-26T13:30") plus
 * `utc_offset_seconds`. Joins them into an ISO 8601 string with an offset.
 * Expects a validated "YYYY-MM-DDTHH:mm" string (see the response schemas).
 */
export function toIsoWithOffset(localTime: string, utcOffsetSeconds: number): string {
  const sign = utcOffsetSeconds < 0 ? '-' : '+';
  const totalMinutes = Math.abs(Math.round(utcOffsetSeconds / 60));
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${localTime}:00${sign}${hours}:${minutes}`;
}

/** "26 Nov, 1:30 pm IST" in the location's time zone. */
export function formatReadingTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

/** Whole minutes from `iso` to `now`, never negative. NaN for an unparseable time. */
export function minutesBetween(iso: string, now: Date): number {
  const elapsed = now.getTime() - Date.parse(iso);
  return Math.max(0, Math.floor(elapsed / MS_PER_MINUTE));
}

/** "fetched just now", "fetched 12 min ago", "fetched 2 h 5 min ago". */
export function formatFetchedAgo(fetchedAtIso: string, now: Date): string {
  const minutes = minutesBetween(fetchedAtIso, now);
  if (minutes < 1) return 'fetched just now';
  if (minutes < 60) return `fetched ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `fetched ${hours} h ago` : `fetched ${hours} h ${rest} min ago`;
}

/**
 * True when the reading itself (not the fetch) is older than the threshold.
 * India readings are hourly, so a fresh fetch can still carry an old reading.
 */
export function isReadingStale(readingIso: string, now: Date): boolean {
  const minutes = minutesBetween(readingIso, now);
  return Number.isNaN(minutes) || minutes > STALE_AFTER_MINUTES;
}
