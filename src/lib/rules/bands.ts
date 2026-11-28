import type { NaqiCategory } from '@shared/types';
import { subIndex } from '../aqi/breakpoints';
import { categoryForIndex } from '../aqi/categories';

/**
 * Band of one hourly PM2.5 value, through the PM2.5 breakpoints
 * (AQI_AND_RULES.md §2). This is an hourly signal for timelines and windows,
 * labelled "PM2.5 level" in the UI — not NAQI, which is a 24-hour measure.
 */
export function pm25Band(pm25Ugm3: number | null): NaqiCategory | null {
  if (pm25Ugm3 === null) return null;
  const index = subIndex('pm25', pm25Ugm3);
  return index === null ? null : categoryForIndex(index);
}

/** Maps hourly PM2.5 values to NAQI bands (null where data is missing). */
export function hourlyPm25Bands(values: readonly (number | null)[]): (NaqiCategory | null)[] {
  return values.map(pm25Band);
}

/** Lower is cleaner; used to rank hours by band. */
export const BAND_RANK: Readonly<Record<NaqiCategory, number>> = {
  good: 0,
  satisfactory: 1,
  moderate: 2,
  poor: 3,
  very_poor: 4,
  severe: 5,
};
