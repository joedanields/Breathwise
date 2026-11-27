import type { Pollutant } from '@shared/types';

/** CO arrives from Open-Meteo in µg/m³; NAQI breakpoints use mg/m³. */
export const CO_UGM3_PER_MGM3 = 1000;

/**
 * Averaging periods and data sufficiency.
 * - 24 h for PM2.5, PM10, NO2, SO2; 8 h for O3 and CO: CPCB "How is AQI
 *   calculated?" item 1 (https://airquality.cpcb.gov.in/ccr_docs/How_AQI_Calculated.pdf)
 *   and R Table 3.11 header.
 * - ≥ 16 valid hours for a 24 h value: same document, item 2; R §3.7 (PDF p.46).
 * - ≥ 6 of 8 hours for O3/CO, and using the latest 8 h mean (not the daily
 *   maximum): Breathwise convention — CPCB states no rule for 8 h windows.
 * - Windows end at the current hour inclusive ("running average", item 4).
 */
export const AVERAGING: Readonly<Record<Pollutant, { hours: number; minValid: number }>> = {
  pm25: { hours: 24, minValid: 16 },
  pm10: { hours: 24, minValid: 16 },
  no2: { hours: 24, minValid: 16 },
  so2: { hours: 24, minValid: 16 },
  o3: { hours: 8, minValid: 6 },
  co: { hours: 8, minValid: 6 },
};

/** Hourly series this module needs (matches the parsed Air Quality response). */
export interface AqHourly {
  readonly time: readonly string[];
  readonly pm25Ugm3: readonly (number | null)[];
  readonly pm10Ugm3: readonly (number | null)[];
  readonly no2Ugm3: readonly (number | null)[];
  readonly so2Ugm3: readonly (number | null)[];
  readonly o3Ugm3: readonly (number | null)[];
  readonly coUgm3: readonly (number | null)[];
}

export interface PollutantAverage {
  /** µg/m³, except CO in mg/m³. `null` when there are too few valid hours. */
  value: number | null;
  validHours: number;
  windowHours: number;
}

/** Index of the last hourly slot at or before `readingIso`; -1 if none. */
export function currentHourIndex(times: readonly string[], readingIso: string): number {
  const reading = Date.parse(readingIso);
  return times.findLastIndex((time) => Date.parse(time) <= reading);
}

/** Mean of the `hours` values ending at `endIndex` (inclusive), skipping nulls. */
export function trailingMean(
  values: readonly (number | null)[],
  endIndex: number,
  hours: number,
  minValid: number,
): { value: number | null; validHours: number } {
  if (endIndex < 0) return { value: null, validHours: 0 };
  const window = values
    .slice(Math.max(0, endIndex - hours + 1), endIndex + 1)
    .filter((v): v is number => v !== null);
  if (window.length < minValid) return { value: null, validHours: window.length };
  const sum = window.reduce((total, v) => total + v, 0);
  return { value: sum / window.length, validHours: window.length };
}

export type Averages = Record<Pollutant, PollutantAverage> & {
  /** O3 at the current hour, for the Table 3.11 footnote (O3 > 208 µg/m³). */
  o3LatestHourUgm3: number | null;
};

export function computeAverages(hourly: AqHourly, endIndex: number): Averages {
  const average = (pollutant: Pollutant, values: readonly (number | null)[]): PollutantAverage => {
    const { hours, minValid } = AVERAGING[pollutant];
    return { ...trailingMean(values, endIndex, hours, minValid), windowHours: hours };
  };
  const co = average('co', hourly.coUgm3);
  return {
    pm25: average('pm25', hourly.pm25Ugm3),
    pm10: average('pm10', hourly.pm10Ugm3),
    no2: average('no2', hourly.no2Ugm3),
    so2: average('so2', hourly.so2Ugm3),
    o3: average('o3', hourly.o3Ugm3),
    co: { ...co, value: co.value === null ? null : co.value / CO_UGM3_PER_MGM3 },
    o3LatestHourUgm3: endIndex >= 0 ? (hourly.o3Ugm3[endIndex] ?? null) : null,
  };
}
