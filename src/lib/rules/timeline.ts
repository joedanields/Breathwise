import type { NaqiCategory, TimeWindow } from '@shared/types';
import { pm25Band } from './bands';
import type { HourlyPm25 } from './windows';

/** The forecast timeline shows the next 48 hours (UI_UX.md §3.2). */
export const TIMELINE_HOURS = 48;

export interface TimelineHour {
  time: string;
  pm25Ugm3: number | null;
  band: NaqiCategory | null;
  /** Window labels covering this hour (W1, W2, V1, V2, X1, X2). */
  labels: string[];
}

/** Hourly PM2.5 from `startIndex` with its band and the windows that cover each hour. */
export function forecastHours(
  hourly: HourlyPm25,
  startIndex: number,
  windows: readonly TimeWindow[],
): TimelineHour[] {
  const from = Math.max(0, startIndex);
  return hourly.time.slice(from, from + TIMELINE_HOURS).map((time, i) => {
    const pm25 = hourly.pm25Ugm3[from + i] ?? null;
    const at = Date.parse(time);
    return {
      time,
      pm25Ugm3: pm25,
      band: pm25Band(pm25),
      labels: windows
        .filter((w) => Date.parse(w.start) <= at && at < Date.parse(w.end))
        .map((w) => w.label),
    };
  });
}
