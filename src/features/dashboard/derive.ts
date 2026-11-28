// Pure values the dashboard derives from live data. No React.
import type { FactsSnapshot } from '@shared/types';
import { forecastHours, type TimelineHour } from '@/lib/rules/timeline';

const PRECIP_LOOKAHEAD_H = 12;

/** The 48-hour PM2.5 timeline from the current hour, marked with the snapshot's windows. */
export function timelineFor(
  snapshot: FactsSnapshot,
  hourly: { time: readonly string[]; pm25Ugm3: readonly (number | null)[] },
  now: Date,
): TimelineHour[] {
  const currentIndex = hourly.time.findLastIndex((t) => Date.parse(t) <= now.getTime());
  const { bestOutdoor, ventilate, worst } = snapshot.windows;
  return forecastHours({ time: hourly.time, pm25Ugm3: hourly.pm25Ugm3 }, currentIndex, [
    ...bestOutdoor,
    ...ventilate,
    ...worst,
  ]);
}

/** Highest chance of rain in the next 12 hours, or null when there is no data. */
export function maxPrecipProbNext12h(
  hourly: { time: readonly string[]; precipProbPct: readonly (number | null)[] },
  now: Date,
): number | null {
  const from = Math.max(
    0,
    hourly.time.findIndex((t) => Date.parse(t) > now.getTime()),
  );
  const present = hourly.precipProbPct
    .slice(from, from + PRECIP_LOOKAHEAD_H)
    .filter((v): v is number => v !== null);
  return present.length > 0 ? Math.max(...present) : null;
}
