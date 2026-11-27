import { Button } from '@/components/ui/Button';
import { AboutPrivacy } from '@/features/about/AboutPrivacy';
import {
  formatFetchedAgo,
  formatReadingTime,
  isReadingStale,
  STALE_AFTER_MINUTES,
} from '@/lib/time';

export const AQ_SOURCE = 'Open-Meteo Air Quality API · CAMS global model';
export const MODEL_NOTE = 'Modelled estimate on a ~45 km grid, not a ground-station reading.';
export const GRID_NOTE = 'nearest model grid point ~45 km';

interface FreshnessBarProps {
  readingTime: string;
  timezone: string;
  fetchedAt: string;
  now: Date;
  /** The latest refresh failed, so the data shown is from an earlier fetch. */
  refreshFailed: boolean;
}

/**
 * Provenance on every data view (CLAUDE.md rule 4): reading time, fetched time,
 * source, modelled-estimate note. Stale by reading time > 90 min (UI_UX.md §4).
 */
export function FreshnessBar({
  readingTime,
  timezone,
  fetchedAt,
  now,
  refreshFailed,
}: FreshnessBarProps) {
  const readingStale = isReadingStale(readingTime, now);
  const stale = readingStale || refreshFailed;
  return (
    <div
      className={`mt-4 space-y-2 border-t border-border pt-3 text-sm ${stale ? '' : 'text-muted'}`}
    >
      {stale && (
        <p className="rounded-md border-2 border-aqi-poor px-3 py-2 font-medium text-text">
          Stale:{' '}
          {readingStale
            ? `this reading is more than ${String(STALE_AFTER_MINUTES)} minutes old.`
            : 'the latest refresh failed, so this is an earlier reading.'}
        </p>
      )}
      <p>
        Reading <time dateTime={readingTime}>{formatReadingTime(readingTime, timezone)}</time>
        {' · '}
        <time dateTime={fetchedAt}>{formatFetchedAgo(fetchedAt, now)}</time>
        {' · '}
        {AQ_SOURCE}
      </p>
      <p>
        {MODEL_NOTE} Resolution: {GRID_NOTE}.{' '}
        <AboutPrivacy
          trigger={
            <Button variant="link" className="min-h-6 text-sm">
              About data
            </Button>
          }
        />
      </p>
    </div>
  );
}
