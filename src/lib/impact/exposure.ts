import type { CommuteMode } from '@shared/types';

/**
 * In-transit PM2.5 as a multiple of ambient, Delhi, morning rush hour:
 * Goel, Gani, Guttikunda, Wilson & Tiwari (2015), "On-road PM2.5 pollution
 * exposure in multiple transport microenvironments in Delhi", Atmospheric
 * Environment 123:129–138, abstract and highlights (p.129):
 * walking +40 %, cycle +10 %, 2W +30 %, auto rickshaw +30 %, open-window car +30 %,
 * AC and open-window bus +20 %, AC car −50 %, metro carriage −20 %.
 * https://urbanemissions.info/wp-content/uploads/docs/2015-12-AE-Delhi-On-Road-Exposures.pdf
 *
 * Cars are null here: their ratio depends on `commute.carAc` (AC 0.5 vs open
 * windows 1.3), see inTransitExposureRatio. WFH is null: no on-road exposure.
 */
export const IN_TRANSIT_EXPOSURE_RATIO: Readonly<Record<CommuteMode, number | null>> = {
  walk: 1.4,
  cycle: 1.1,
  two_wheeler: 1.3,
  auto_rickshaw: 1.3,
  bus: 1.2,
  metro: 0.8,
  car_petrol: null,
  car_diesel: null,
  car_cng: null,
  wfh: null,
};

/** Cars by AC use (E): AC car −50 % (0.5×), open-window car +30 % (1.3×). */
export const CAR_EXPOSURE_RATIO = { ac_closed: 0.5, windows_open: 1.3 } as const;

export type CarAc = keyof typeof CAR_EXPOSURE_RATIO;

/** In-transit ratio for a mode; cars use the AC setting and are null when it's unknown. */
export function inTransitExposureRatio(mode: CommuteMode, carAc: CarAc | undefined): number | null {
  if (mode.startsWith('car_')) return carAc ? CAR_EXPOSURE_RATIO[carAc] : null;
  return IN_TRANSIT_EXPOSURE_RATIO[mode];
}

export const EXPOSURE_SOURCE =
  'Goel et al. (2015), On-road PM2.5 exposure in multiple transport microenvironments in Delhi, Atmospheric Environment 123:129–138 (p.129)';
export const EXPOSURE_SOURCE_URL =
  'https://urbanemissions.info/wp-content/uploads/docs/2015-12-AE-Delhi-On-Road-Exposures.pdf';

/**
 * Breathwise convention: a switch has an exposure benefit only when the new
 * mode was below ambient in the study (ratio < 1, i.e. metro) and below the
 * current mode, or when it removes a trip that is above ambient (ratio > 1;
 * an AC car at 0.5× is not clearly worse than home air). Buses (1.2) stay
 * above ambient, so no benefit is claimed for them.
 */
export function hasExposureBenefit(from: number, to: number | null, removesTrip: boolean): boolean {
  if (removesTrip) return from > 1;
  return to !== null && to < 1 && to < from;
}
