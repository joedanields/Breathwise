import type { NaqiCategory } from '@shared/types';

/** R Table 3.2 / Table 3.11 ranges: 0–50, 51–100, 101–200, 201–300, 301–400, 401–500. */
const UPPER_INDEX: readonly [number, NaqiCategory][] = [
  [50, 'good'],
  [100, 'satisfactory'],
  [200, 'moderate'],
  [300, 'poor'],
  [400, 'very_poor'],
];

/** Category of an index; the index is rounded to an integer first (AQI_AND_RULES.md §1.3). */
export function categoryForIndex(index: number): NaqiCategory {
  const rounded = Math.round(index);
  return UPPER_INDEX.find(([upper]) => rounded <= upper)?.[1] ?? 'severe';
}

export const CATEGORY_LABELS: Readonly<Record<NaqiCategory, string>> = {
  good: 'Good',
  satisfactory: 'Satisfactory',
  moderate: 'Moderate',
  poor: 'Poor',
  very_poor: 'Very Poor',
  severe: 'Severe',
};
