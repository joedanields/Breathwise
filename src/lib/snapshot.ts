import type { FactsSnapshot, HouseholdProfile, TimeWindow } from '@shared/types';
import { type AqHourly, computeAverages, CO_UGM3_PER_MGM3, currentHourIndex } from './aqi/averages';
import { computeNaqi } from './aqi/naqi';
import { roundCoordinate } from './coords';
import { commuteImpactFacts } from './impact/commuteEmissions';
import { pm25Band } from './rules/bands';
import { computeMemberRisk } from './rules/memberRisk';
import { purifierFacts } from './rules/purifier';
import { computeTrend } from './rules/trend';
import { findVentilationWindows } from './rules/ventilation';
import {
  durationHoursFor,
  findBestWindows,
  type HourlyPm25,
  WINDOW_DEFAULTS,
} from './rules/windows';
import { isoAtOffsetOf, localHour } from './time';

type Num = number | null;

/** Parsed Air Quality data (structurally the same as `AirQualityData`). */
export interface SnapshotAirQuality {
  timezone: string;
  current: {
    time: string;
    pm25Ugm3: Num;
    pm10Ugm3: Num;
    no2Ugm3: Num;
    so2Ugm3: Num;
    o3Ugm3: Num;
    coUgm3: Num;
    usAqi: Num;
    dustUgm3: Num;
    uvIndex: Num;
  };
  hourly: AqHourly;
}

/** Parsed Forecast data (structurally the same as `WeatherData`). */
export interface SnapshotWeather {
  current: { temperatureC: Num; humidityPct: Num; windKmh: Num; windDirDeg: Num };
  hourly: {
    time: readonly string[];
    windKmh: readonly Num[];
    precipProbPct: readonly Num[];
    boundaryLayerHeightM: readonly Num[];
  };
}

/** Everything `buildFactsSnapshot` needs: live data, fetch time, profile and location. */
export interface SnapshotInput {
  airQuality: SnapshotAirQuality;
  /** When this browser fetched the air-quality data (ISO). */
  fetchedAt: string;
  weather: SnapshotWeather | null;
  location: { label: string; state?: string; latitude: number; longitude: number };
  profile: HouseholdProfile;
  /** Passed in so the builder stays pure (no clock reads). */
  now: Date;
}

export const SNAPSHOT_PROVENANCE = {
  source: 'Open-Meteo Air Quality API',
  model: 'CAMS global',
  note: 'Modelled estimate on a ~45 km grid, not a ground-station reading; nearest model grid point ~45 km.',
} as const;

const round = (value: Num, decimals = 0): Num => {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const roundWindow = (window: TimeWindow): TimeWindow => ({
  ...window,
  avgPm25Ugm3: Math.round(window.avgPm25Ugm3),
});

/** Ids must be [a-z0-9_]: "kid-1" -> "kid_1". */
const idPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, '_');

/** Mean PM2.5 of `durationH` hours starting at the first `hour`:00 at or after `fromIndex`. */
function usualTimeAverage(hourly: HourlyPm25, fromIndex: number, hour: number, durationH: number) {
  const end = Math.min(fromIndex + WINDOW_DEFAULTS.horizonH, hourly.time.length);
  for (let i = Math.max(0, fromIndex); i < end; i++) {
    const time = hourly.time[i];
    if (time === undefined || localHour(time) !== hour) continue;
    const values = hourly.pm25Ugm3.slice(i, i + durationH);
    if (values.length < durationH || !values.every((v): v is number => v !== null)) return null;
    return values.reduce((sum, v) => sum + v, 0) / durationH;
  }
  return null;
}

/** A comparison fact saying how much lower or higher `value` is than `ref`, in whole percent. */
export function percentComparison(
  id: string,
  subject: string,
  reference: string,
  value: number,
  ref: number,
) {
  const pct = Math.round(((ref - value) / ref) * 100);
  if (pct === 0)
    return { id, text: `${subject} is about the same as ${reference}`, value: 0, unit: '%' };
  return {
    id,
    text: `${subject} is ${pct > 0 ? 'lower' : 'higher'} than ${reference} by`,
    value: Math.abs(pct),
    unit: '%',
  };
}

/**
 * Builds the FactsSnapshot the AI receives (ARCHITECTURE.md §4–5). Pure:
 * every number comes from the inputs or from `lib/` rules; `now` is a parameter.
 * Validate the result with `FactsSnapshotSchema` at the boundary.
 */
export function buildFactsSnapshot(input: SnapshotInput): FactsSnapshot {
  const { airQuality, weather, location, profile, now } = input;
  const { current, hourly } = airQuality;
  const pm25: HourlyPm25 = { time: hourly.time, pm25Ugm3: hourly.pm25Ugm3 };

  const currentIndex = currentHourIndex(hourly.time, current.time);
  const naqi = computeNaqi(computeAverages(hourly, currentIndex));
  const currentBand = pm25Band(current.pm25Ugm3);

  // Windows start at the next full hour after "now".
  const nextHour = hourly.time.findIndex((time) => Date.parse(time) > now.getTime());
  const fromIndex = nextHour === -1 ? hourly.time.length : nextHour;
  const durationH = Math.max(
    1,
    ...profile.members.map((m) => durationHoursFor(m.outdoorActivity?.durationMin)),
  );
  const { best, worst } = findBestWindows(pm25, { fromIndex, durationH });

  const windByTime = weather
    ? new Map(weather.hourly.time.map((time, i) => [time, weather.hourly.windKmh[i] ?? null]))
    : null;
  const ventilate = findVentilationWindows(pm25, windByTime, { fromIndex });

  return {
    version: 1,
    generatedAt: isoAtOffsetOf(now, current.time),
    location: {
      name: location.label,
      ...(location.state ? { state: location.state } : {}),
      latRounded: roundCoordinate(location.latitude),
      lonRounded: roundCoordinate(location.longitude),
      timezone: airQuality.timezone,
    },
    provenance: {
      ...SNAPSHOT_PROVENANCE,
      readingTime: current.time,
      fetchedAt: input.fetchedAt,
      isModelledEstimate: true,
    },
    current: currentReadings(current),
    pm25Band: currentBand,
    naqi: naqi && { ...naqi, isEstimate: true },
    trend: computeTrend(hourly.pm25Ugm3, currentIndex),
    weather: weather && weatherFacts(weather, hourly.time[currentIndex]),
    windows: {
      bestOutdoor: best.map(roundWindow),
      ventilate: ventilate.map(roundWindow),
      worst: worst.map(roundWindow),
    },
    memberRisk: computeMemberRisk(
      profile.members,
      naqi?.category ?? currentBand,
      naqi ? 'naqi' : 'pm25_hourly',
    ),
    purifier: purifierFacts(profile.home),
    impactFacts: commuteImpactFacts(profile.commute),
    comparisons: windowComparisons(pm25, fromIndex, best[0], current.pm25Ugm3, profile.members),
    profile,
  };
}

/** Current pollutant readings, rounded, with CO converted to mg/m³. */
function currentReadings(current: SnapshotAirQuality['current']): FactsSnapshot['current'] {
  return {
    pm25Ugm3: round(current.pm25Ugm3),
    pm10Ugm3: round(current.pm10Ugm3),
    no2Ugm3: round(current.no2Ugm3),
    so2Ugm3: round(current.so2Ugm3),
    o3Ugm3: round(current.o3Ugm3),
    coMgm3: round(current.coUgm3 === null ? null : current.coUgm3 / CO_UGM3_PER_MGM3, 1),
    usAqi: round(current.usAqi),
    dustUgm3: round(current.dustUgm3),
    uvIndex: round(current.uvIndex, 1),
  };
}

/** Current weather plus rain chance and mixing height at the air-quality reading hour. */
function weatherFacts(
  weather: SnapshotWeather,
  readingHour: string | undefined,
): NonNullable<FactsSnapshot['weather']> {
  const index = weather.hourly.time.indexOf(readingHour ?? '');
  const atReadingHour = (series: readonly Num[]) => (index >= 0 ? (series[index] ?? null) : null);
  return {
    tempC: round(weather.current.temperatureC, 1),
    humidityPct: round(weather.current.humidityPct),
    windKmh: round(weather.current.windKmh, 1),
    windDirDeg: round(weather.current.windDirDeg),
    precipProbPct: round(atReadingHour(weather.hourly.precipProbPct)),
    boundaryLayerHeightM: round(atReadingHour(weather.hourly.boundaryLayerHeightM)),
  };
}

/** How much cleaner W1 is than now and than each member's usual activity time. */
function windowComparisons(
  pm25: HourlyPm25,
  fromIndex: number,
  w1: { avgPm25Ugm3: number } | undefined,
  currentPm25: Num,
  members: HouseholdProfile['members'],
): FactsSnapshot['comparisons'] {
  if (!w1) return [];
  const comparisons: FactsSnapshot['comparisons'] = [];
  if (currentPm25 !== null && currentPm25 > 0) {
    comparisons.push(
      percentComparison('w1_vs_now', 'PM2.5 in W1', 'now', w1.avgPm25Ugm3, currentPm25),
    );
  }
  for (const member of members) {
    const activity = member.outdoorActivity;
    if (!activity) continue;
    const usual = usualTimeAverage(
      pm25,
      fromIndex,
      Number(activity.usualStart.slice(0, 2)),
      durationHoursFor(activity.durationMin),
    );
    if (usual === null || usual <= 0) continue;
    comparisons.push(
      percentComparison(
        `w1_vs_usual_${idPart(member.id)}`,
        'PM2.5 in W1',
        `${member.label}'s usual ${activity.kind} time (${activity.usualStart})`,
        w1.avgPm25Ugm3,
        usual,
      ),
    );
  }
  return comparisons;
}
