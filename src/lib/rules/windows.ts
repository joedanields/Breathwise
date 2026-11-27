import type { NaqiCategory, TimeWindow } from '@shared/types';
import { addHoursKeepingOffset, localHour } from '../time';
import { pm25Band } from './bands';

export interface HourlyPm25 {
  /** ISO times with the location's offset, one per hour. */
  readonly time: readonly string[];
  readonly pm25Ugm3: readonly (number | null)[];
}

export interface WindowSearch {
  /** First hourly index a window may start at (the next full hour). */
  fromIndex: number;
  horizonH?: number;
  durationH?: number;
  /** [first start hour, latest end hour], local time. */
  wakingHours?: readonly [number, number];
  maxResults?: number;
}

/** AQI_AND_RULES.md §4 defaults. */
export const WINDOW_DEFAULTS = {
  horizonH: 24,
  durationH: 1,
  wakingHours: [6, 21] as const,
  maxResults: 2,
};

/** Activity minutes -> whole hours, at least 1 (AQI_AND_RULES.md §4). */
export function durationHoursFor(minutes: number | undefined): number {
  return minutes === undefined ? 1 : Math.max(1, Math.ceil(minutes / 60));
}

interface Candidate {
  startIndex: number;
  durationH: number;
  avg: number;
}

/** All windows of `durationH` complete, non-null hours inside the horizon and waking hours. */
function candidates(hourly: HourlyPm25, options: Required<WindowSearch>): Candidate[] {
  const { fromIndex, horizonH, durationH, wakingHours } = options;
  const [wakeStart, wakeEnd] = wakingHours;
  const lastStart = Math.min(fromIndex + horizonH, hourly.time.length) - durationH;
  const found: Candidate[] = [];
  for (let start = Math.max(0, fromIndex); start <= lastStart; start++) {
    const startTime = hourly.time[start];
    if (startTime === undefined) continue;
    const hour = localHour(startTime);
    if (hour < wakeStart || hour + durationH > wakeEnd) continue;
    const values = hourly.pm25Ugm3.slice(start, start + durationH);
    if (!values.every((v): v is number => v !== null)) continue;
    const sum = values.reduce((total, v) => total + v, 0);
    found.push({ startIndex: start, durationH, avg: sum / durationH });
  }
  return found;
}

/** Greedy pick of non-overlapping windows; `order` decides preference, earlier start breaks ties. */
function pickNonOverlapping(
  list: Candidate[],
  order: (a: Candidate, b: Candidate) => number,
  max: number,
): Candidate[] {
  const sorted = [...list].sort((a, b) => order(a, b) || a.startIndex - b.startIndex);
  const picked: Candidate[] = [];
  for (const candidate of sorted) {
    if (picked.length === max) break;
    const overlaps = picked.some(
      (p) =>
        candidate.startIndex < p.startIndex + p.durationH &&
        p.startIndex < candidate.startIndex + candidate.durationH,
    );
    if (!overlaps) picked.push(candidate);
  }
  return picked;
}

export function toTimeWindow(
  hourly: HourlyPm25,
  startIndex: number,
  durationH: number,
  avg: number,
  label: string,
): TimeWindow {
  const start = hourly.time[startIndex] ?? '';
  const band: NaqiCategory = pm25Band(avg) ?? 'severe';
  return { label, start, end: addHoursKeepingOffset(start, durationH), avgPm25Ugm3: avg, band };
}

/**
 * Best and worst outdoor windows by mean PM2.5 (AQI_AND_RULES.md §4):
 * best = lowest, labelled W1, W2; worst = highest, labelled X1, X2.
 */
export function findBestWindows(
  hourly: HourlyPm25,
  search: WindowSearch,
): { best: TimeWindow[]; worst: TimeWindow[] } {
  const options = { ...WINDOW_DEFAULTS, ...search };
  const all = candidates(hourly, options);
  const label = (prefix: string) => (c: Candidate, i: number) =>
    toTimeWindow(hourly, c.startIndex, c.durationH, c.avg, `${prefix}${String(i + 1)}`);
  return {
    best: pickNonOverlapping(all, (a, b) => a.avg - b.avg, options.maxResults).map(label('W')),
    worst: pickNonOverlapping(all, (a, b) => b.avg - a.avg, options.maxResults).map(label('X')),
  };
}
