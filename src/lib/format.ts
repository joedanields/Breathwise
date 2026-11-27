/** Shown in place of a missing value. Missing is never shown as 0. */
export const NOT_AVAILABLE = 'Not available';

/**
 * Formats a measurement for display only (DATA_SOURCES.md §7: round only for
 * display, keep raw values for computation). `null` means missing.
 */
export function formatMeasurement(value: number | null, unit: string, decimals = 0): string {
  if (value === null) return NOT_AVAILABLE;
  const number = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  if (!unit) return number;
  // Angles take no space ("252°"); other units do ("19.1 °C").
  return unit === '°' ? `${number}°` : `${number} ${unit}`;
}

/** CO arrives in µg/m³; NAQI and display use mg/m³. */
export function ugm3ToMgm3(ugm3: number | null): number | null {
  return ugm3 === null ? null : ugm3 / 1000;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** "NW" for 315°: the 8-point compass direction the wind blows from. */
export function compassPoint(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8] ?? 'N';
}
