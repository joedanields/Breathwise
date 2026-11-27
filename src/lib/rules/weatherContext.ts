/**
 * Rules-based weather context for the WeatherStrip (UI_UX.md §3.2: "copy from
 * rules, not AI"). Breathwise convention thresholds; at most two sentences,
 * most important first. Missing values are skipped, never assumed.
 */
export interface WeatherContextInput {
  windKmh: number | null;
  humidityPct: number | null;
  /** Highest precipitation probability in the next 12 hours. */
  maxPrecipProbPct: number | null;
  boundaryLayerHeightM: number | null;
}

export const CALM_WIND_KMH = 5;
export const BREEZY_WIND_KMH = 12;
export const HUMID_PCT = 80;
export const RAIN_LIKELY_PCT = 50;
export const LOW_MIXING_HEIGHT_M = 300;

export function weatherContext({
  windKmh,
  humidityPct,
  maxPrecipProbPct,
  boundaryLayerHeightM,
}: WeatherContextInput): string[] {
  const sentences: string[] = [];
  if (boundaryLayerHeightM !== null && boundaryLayerHeightM < LOW_MIXING_HEIGHT_M) {
    sentences.push('A low mixing layer is trapping pollution near the ground.');
  }
  if (windKmh !== null && windKmh < CALM_WIND_KMH) {
    sentences.push('Calm air is letting pollution build up near the ground.');
  }
  if (maxPrecipProbPct !== null && maxPrecipProbPct >= RAIN_LIKELY_PCT) {
    sentences.push('Rain later may help clear the air.');
  }
  if (humidityPct !== null && humidityPct >= HUMID_PCT) {
    sentences.push('Humid air can make haze linger.');
  }
  if (sentences.length === 0 && windKmh !== null && windKmh >= BREEZY_WIND_KMH) {
    sentences.push('A steady breeze is helping disperse pollution.');
  }
  return sentences.slice(0, 2);
}
