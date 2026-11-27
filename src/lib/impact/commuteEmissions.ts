import type { CommuteMode, HouseholdProfile, ImpactFact } from '@shared/types';
import { EMISSION_FACTORS } from './emissionFactors';
import {
  EXPOSURE_SOURCE,
  EXPOSURE_SOURCE_URL,
  hasExposureBenefit,
  inTransitExposureRatio,
} from './exposure';

type Commute = NonNullable<HouseholdProfile['commute']>;

const MODE_NAMES: Readonly<Record<CommuteMode, string>> = {
  walk: 'walking',
  cycle: 'cycling',
  two_wheeler: 'two-wheeler',
  car_petrol: 'petrol car',
  car_diesel: 'diesel car',
  car_cng: 'CNG car',
  auto_rickshaw: 'auto-rickshaw',
  bus: 'bus',
  metro: 'metro',
  wfh: 'working from home',
};

const CAR_MODES: readonly CommuteMode[] = ['car_petrol', 'car_diesel', 'car_cng'];
const BOUNDARY_NOTE =
  ' Metro figures include power-station emissions; road figures count tailpipe only.';

/** weeklyKg = factor × oneWayKm × 2 × daysPerWeek ÷ occupants (vehicle-km factors only). */
export function weeklyCommuteKg(
  mode: CommuteMode,
  oneWayKm: number,
  daysPerWeek: number,
  occupants = 1,
): number {
  const factor = EMISSION_FACTORS[mode];
  const km = oneWayKm * 2 * daysPerWeek;
  return factor.basis === 'vehicle_km'
    ? (factor.kgCo2PerKm * km) / occupants
    : factor.kgCo2PerKm * km;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

interface Alternative {
  id: string;
  mode: CommuteMode;
  phrase: string;
  kg: number;
  removesTrip: boolean;
}

function describeDelta(phrase: string, delta: number, current: CommuteMode, mode: CommuteMode) {
  const versus = `compared with your current ${MODE_NAMES[current]}`;
  const note = mode === 'metro' || current === 'metro' ? BOUNDARY_NOTE : '';
  if (delta < 0)
    return `${phrase} would cut about ${String(-delta)} kg CO₂ a week ${versus}.${note}`;
  if (delta > 0) {
    return `${phrase} would add about ${String(delta)} kg CO₂ a week ${versus}, so it is not a CO₂ saving.${note}`;
  }
  return `${phrase} would leave weekly CO₂ about the same as your current ${MODE_NAMES[current]}.${note}`;
}

/**
 * Impact facts for the AI and fallback plan (AQI_AND_RULES.md §8). Every CO2
 * fact carries a signed weekly delta against the current mode: negative is a
 * saving, positive an increase, 0 no change. Exposure benefits are separate
 * facts, so the health case can be made when there is no CO2 case.
 * No distance or days -> no facts.
 */
export function commuteImpactFacts(commute: Commute | undefined): ImpactFact[] {
  if (!commute || commute.mode === 'wfh') return [];
  const { mode, oneWayKm, daysPerWeek } = commute;
  if (oneWayKm === undefined || daysPerWeek === undefined) return [];

  const currentKg = round2(weeklyCommuteKg(mode, oneWayKm, daysPerWeek));
  const factor = EMISSION_FACTORS[mode];
  const facts: ImpactFact[] = [
    {
      id: 'co2_current',
      category: 'co2',
      mode,
      description: `Your current commute by ${MODE_NAMES[mode]} (${String(oneWayKm)} km each way, ${String(daysPerWeek)} days a week) emits about ${String(currentKg)} kg CO₂ a week.`,
      kgCo2PerWeek: currentKg,
      kgCo2PerWeekDelta: 0,
      source: factor.source,
      sourceUrl: factor.sourceUrl,
    },
  ];

  const alternatives: Alternative[] = [];
  if (CAR_MODES.includes(mode)) {
    for (const occupants of [2, 3]) {
      alternatives.push({
        id: `co2_carpool_${String(occupants)}`,
        mode,
        phrase: `Carpooling with ${String(occupants)} people`,
        kg: weeklyCommuteKg(mode, oneWayKm, daysPerWeek, occupants),
        removesTrip: false,
      });
    }
  }
  for (const alt of ['bus', 'metro'] as const) {
    if (alt === mode) continue;
    alternatives.push({
      id: `co2_${alt}`,
      mode: alt,
      phrase: `Switching to the ${alt}`,
      kg: weeklyCommuteKg(alt, oneWayKm, daysPerWeek),
      removesTrip: false,
    });
  }
  alternatives.push({
    id: 'co2_wfh_extra_day',
    mode: 'wfh',
    phrase: 'One fewer commuting day a week (e.g. working from home)',
    kg: weeklyCommuteKg(mode, oneWayKm, daysPerWeek - 1),
    removesTrip: true,
  });

  const fromRatio = inTransitExposureRatio(mode, commute.carAc);
  for (const alt of alternatives) {
    const kg = round2(alt.kg);
    const delta = round2(kg - currentKg);
    const altFactor = EMISSION_FACTORS[alt.mode === 'wfh' ? mode : alt.mode];
    facts.push({
      id: alt.id,
      category: 'co2',
      mode: alt.mode,
      description: describeDelta(alt.phrase, delta, mode, alt.mode),
      kgCo2PerWeek: kg,
      kgCo2PerWeekDelta: delta,
      source: altFactor.source,
      sourceUrl: altFactor.sourceUrl,
    });

    const toRatio = alt.removesTrip ? null : inTransitExposureRatio(alt.mode, undefined);
    if (
      alt.mode !== mode &&
      fromRatio !== null &&
      hasExposureBenefit(fromRatio, toRatio, alt.removesTrip)
    ) {
      facts.push({
        id: alt.id.replace(/^co2_/, 'exposure_'),
        category: 'exposureBenefit',
        mode: alt.mode,
        description:
          toRatio === null
            ? `${alt.phrase} avoids a day of on-road PM2.5, which averaged ${String(fromRatio)}× the outdoor level for ${MODE_NAMES[mode]} in a Delhi study.`
            : `In a Delhi study, PM2.5 inside metro carriages averaged ${String(toRatio)}× the outdoor level, against ${String(fromRatio)}× for ${MODE_NAMES[mode]}.`,
        exposureRatioFrom: fromRatio,
        exposureRatioTo: toRatio,
        source: EXPOSURE_SOURCE,
        sourceUrl: EXPOSURE_SOURCE_URL,
      });
    }
  }
  return facts;
}
