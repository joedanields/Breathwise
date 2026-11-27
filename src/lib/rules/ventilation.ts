import type { TimeWindow } from '@shared/types';
import { localHour } from '../time';
import { BAND_RANK, pm25Band } from './bands';
import { type HourlyPm25, toTimeWindow, WINDOW_DEFAULTS } from './windows';

/** AQI_AND_RULES.md §5: wind at or above this disperses pollution better. */
export const WINDY_KMH = 8;

export interface VentilationSearch {
  fromIndex: number;
  horizonH?: number;
  wakingHours?: readonly [number, number];
  maxResults?: number;
}

/**
 * Ventilation windows (AQI_AND_RULES.md §5): up to 2 one-hour slots (advice is
 * 15–30 min of airing within the slot), labelled V1, V2 by preference.
 * Ranking: cleaner PM2.5 band first, then windy (≥ 8 km/h) hours, then lower
 * PM2.5, then earlier. Hours in the Very Poor or Severe band never qualify; if
 * none qualify, returns [] ("keep windows closed").
 *
 * `windKmhByTime` maps the same ISO hour strings to wind speed; null without weather.
 */
export function findVentilationWindows(
  hourly: HourlyPm25,
  windKmhByTime: ReadonlyMap<string, number | null> | null,
  search: VentilationSearch,
): TimeWindow[] {
  const { fromIndex, horizonH, wakingHours, maxResults } = { ...WINDOW_DEFAULTS, ...search };
  const [wakeStart, wakeEnd] = wakingHours;
  const end = Math.min(fromIndex + horizonH, hourly.time.length);

  const hours: { index: number; pm: number; rank: number; windy: boolean }[] = [];
  for (let index = Math.max(0, fromIndex); index < end; index++) {
    const time = hourly.time[index];
    const pm = hourly.pm25Ugm3[index];
    if (time === undefined || pm === null || pm === undefined) continue;
    const hour = localHour(time);
    if (hour < wakeStart || hour + 1 > wakeEnd) continue;
    const band = pm25Band(pm);
    if (band === null || band === 'very_poor' || band === 'severe') continue;
    const wind = windKmhByTime?.get(time) ?? null;
    hours.push({ index, pm, rank: BAND_RANK[band], windy: wind !== null && wind >= WINDY_KMH });
  }

  return hours
    .sort(
      (a, b) =>
        a.rank - b.rank || Number(b.windy) - Number(a.windy) || a.pm - b.pm || a.index - b.index,
    )
    .slice(0, maxResults)
    .map((h, i) => toTimeWindow(hourly, h.index, 1, h.pm, `V${String(i + 1)}`));
}
