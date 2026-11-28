/** Direction of the PM2.5 trend. */
export type Trend = 'rising' | 'falling' | 'steady';

/** AQI_AND_RULES.md §3: a change beyond ±10 % is a trend. Exactly 10 % is steady. */
export const TREND_THRESHOLD = 0.1;
const SIDE_HOURS = 3;
/** Breathwise convention: each side needs at least 2 of its 3 hours. */
const MIN_VALUES_PER_SIDE = 2;

function mean(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < MIN_VALUES_PER_SIDE) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/**
 * Mean PM2.5 of the next 3 hours vs the previous 3 hours (the current hour and
 * the 2 before it). `null` when either side lacks data.
 */
export function computeTrend(pm25: readonly (number | null)[], currentIndex: number): Trend | null {
  const previous = mean(pm25.slice(Math.max(0, currentIndex - SIDE_HOURS + 1), currentIndex + 1));
  const next = mean(pm25.slice(currentIndex + 1, currentIndex + 1 + SIDE_HOURS));
  if (previous === null || next === null) return null;
  if (previous === 0) return next > 0 ? 'rising' : 'steady';
  const change = (next - previous) / previous;
  if (change > TREND_THRESHOLD) return 'rising';
  if (change < -TREND_THRESHOLD) return 'falling';
  return 'steady';
}
