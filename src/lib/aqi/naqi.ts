import type { NaqiCategory, Pollutant } from '@shared/types';
import type { Averages } from './averages';
import { O3_ONE_HOUR_SWITCH_UGM3, POLLUTANTS, subIndex } from './breakpoints';
import { categoryForIndex } from './categories';

export type PollutantAverages = Averages;

export interface NaqiResult {
  value: number;
  category: NaqiCategory;
  dominant: Pollutant;
  subIndices: Partial<Record<Pollutant, number>>;
  /** Fewest valid hours among the averages used. */
  hoursUsed: number;
  /** Which O3 value was used, or null when O3 was unavailable. */
  o3Basis: '8h' | '1h' | null;
}

const PM: readonly Pollutant[] = ['pm25', 'pm10'];
const MIN_POLLUTANTS = 3;

/**
 * Overall NAQI (CPCB "How is AQI calculated?" items 1–2; R §3.5, §3.7):
 * worst sub-index, valid only with ≥ 3 pollutants including PM2.5 or PM10.
 * Ties go to the first pollutant in POLLUTANTS order (deterministic).
 */
export function computeNaqi(averages: PollutantAverages): NaqiResult | null {
  const raw: { pollutant: Pollutant; index: number; hours: number }[] = [];
  let o3Basis: NaqiResult['o3Basis'] = null;

  for (const pollutant of POLLUTANTS) {
    const { value, validHours } = averages[pollutant];
    if (value === null) continue;
    let concentration = value;
    if (pollutant === 'o3') {
      const oneHour = averages.o3LatestHourUgm3;
      const useOneHour = value > O3_ONE_HOUR_SWITCH_UGM3 && oneHour !== null;
      concentration = useOneHour ? oneHour : value;
      o3Basis = useOneHour ? '1h' : '8h';
    }
    const index = subIndex(pollutant, concentration);
    if (index !== null) raw.push({ pollutant, index, hours: validHours });
  }

  if (raw.length < MIN_POLLUTANTS || !raw.some(({ pollutant }) => PM.includes(pollutant))) {
    return null;
  }

  // Strictly greater keeps the earliest pollutant on ties.
  const worst = raw.reduce((best, entry) => (entry.index > best.index ? entry : best));
  const value = Math.min(500, Math.round(worst.index));
  return {
    value,
    category: categoryForIndex(value),
    dominant: worst.pollutant,
    subIndices: Object.fromEntries(
      raw.map(({ pollutant, index }) => [pollutant, Math.round(index)]),
    ),
    hoursUsed: Math.min(...raw.map(({ hours }) => hours)),
    o3Basis,
  };
}
