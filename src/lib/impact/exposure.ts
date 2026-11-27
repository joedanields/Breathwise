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
 * Cars are null: the profile doesn't record AC, and AC (0.5) vs open windows
 * (1.3) changes the answer. WFH is null: no on-road exposure at all.
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

export const EXPOSURE_SOURCE =
  'Goel et al. (2015), On-road PM2.5 exposure in multiple transport microenvironments in Delhi, Atmospheric Environment 123:129–138 (p.129)';
export const EXPOSURE_SOURCE_URL =
  'https://urbanemissions.info/wp-content/uploads/docs/2015-12-AE-Delhi-On-Road-Exposures.pdf';

/**
 * Breathwise convention: a switch has an exposure benefit only when the new
 * mode was below ambient in the study (ratio < 1, i.e. metro) and below the
 * current mode, or when it removes the trip (WFH). Buses (1.2) stay above
 * ambient, so no benefit is claimed for them.
 */
export function hasExposureBenefit(from: number | null, to: number | null, removesTrip: boolean) {
  if (from === null) return false;
  if (removesTrip) return true;
  return to !== null && to < 1 && to < from;
}
