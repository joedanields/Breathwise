import type { NaqiCategory } from '@shared/types';

/** Full class strings (Tailwind needs them literally). Contrast pairs: UI_UX.md §2. */
export const CATEGORY_CLASSES: Readonly<Record<NaqiCategory, string>> = {
  good: 'bg-aqi-good text-on-aqi-good',
  satisfactory: 'bg-aqi-satisfactory text-on-aqi-satisfactory',
  moderate: 'bg-aqi-moderate text-on-aqi-moderate',
  poor: 'bg-aqi-poor text-on-aqi-poor',
  very_poor: 'bg-aqi-very-poor text-on-aqi-very-poor',
  severe: 'bg-aqi-severe text-on-aqi-severe',
};
