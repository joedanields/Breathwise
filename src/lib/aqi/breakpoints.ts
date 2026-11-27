import type { Pollutant } from '@shared/types';

/**
 * NAQI breakpoints.
 *
 * Primary source (R): CPCB, "National Air Quality Index", Control of Urban
 * Pollution Series CUPS/82/2014-15, Table 3.11 "Breakpoints for AQI Scale 0-500"
 * (PDF p.37, printed p.35):
 * https://cpcb.gov.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvRklOQUwtUkVQT1JUX0FRSV8ucGRm
 *
 * Severe-band upper bounds (the "+" band, 401–500) are NOT published by CPCB:
 * Table 3.11 is open-ended. The values marked "convention" come from the AQI
 * calculator hosted on CPCB's CCR site (X, a 2026 reproduction, not the 2014
 * tool): https://app.cpcbccr.com/ccr_docs/AQI-Calculator.xls ("Breakpoints"
 * sheet, band 6). They only move the number within 401–500; the category is
 * unaffected. Concentrations above them cap at 500.
 *
 * Bands are continuous (Breathwise convention, AQI_AND_RULES.md §1.3): each band
 * starts at the previous band's published upper edge, so modelled values such as
 * 30.4 µg/m³ fall in a band. This follows R §3.5's formula (PDF p.39), where
 * I_LO is reduced by one above 50; it can differ by 1 from the integer-band
 * reading at the very start of a band (e.g. PM2.5 31 -> 52 here, 51 in X).
 */
export interface Segment {
  /** Concentration range: µg/m³, except CO in mg/m³. */
  readonly cLo: number;
  readonly cHi: number;
  readonly iLo: number;
  readonly iHi: number;
}

/** Fixed order: also the tie-break order for the dominant pollutant. */
export const POLLUTANTS = [
  'pm25',
  'pm10',
  'no2',
  'o3',
  'co',
  'so2',
] as const satisfies readonly Pollutant[];

/** Six bands: index 0–50, 50–100, 100–200, 200–300, 300–400, 400–500. */
function segments([e1, e2, e3, e4, e5, e6]: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
]): Segment[] {
  return [
    { cLo: 0, cHi: e1, iLo: 0, iHi: 50 },
    { cLo: e1, cHi: e2, iLo: 50, iHi: 100 },
    { cLo: e2, cHi: e3, iLo: 100, iHi: 200 },
    { cLo: e3, cHi: e4, iLo: 200, iHi: 300 },
    { cLo: e4, cHi: e5, iLo: 300, iHi: 400 },
    { cLo: e5, cHi: e6, iLo: 400, iHi: 500 },
  ];
}

export const BREAKPOINTS: Readonly<Record<Pollutant, readonly Segment[]>> = {
  // PM2.5 24-hr µg/m³ — R Table 3.11: 0–30, 31–60, 61–90, 91–120, 121–250, 250+. Severe top 380: X (convention).
  pm25: segments([30, 60, 90, 120, 250, 380]),
  // PM10 24-hr µg/m³ — R Table 3.11: 0–50, 51–100, 101–250, 251–350, 351–430, 430+. Severe top 510: X (convention).
  pm10: segments([50, 100, 250, 350, 430, 510]),
  // NO2 24-hr µg/m³ — R Table 3.11: 0–40, 41–80, 81–180, 181–280, 281–400, 400+. Severe top 520: X (convention).
  no2: segments([40, 80, 180, 280, 400, 520]),
  // O3 8-hr µg/m³ — R Table 3.11: 0–50, 51–100, 101–168, 169–208, 209–748*, 748+*. Severe top 1000: X (convention).
  // * R footnote: "One hourly monitoring (for mathematical calculation only)" — see O3_ONE_HOUR_SWITCH_UGM3.
  o3: segments([50, 100, 168, 208, 748, 1000]),
  // CO 8-hr mg/m³ — R Table 3.11: 0–1.0, 1.1–2.0, 2.1–10, 10.1–17, 17.1–34, 34+. Severe top 50: X (convention).
  co: segments([1, 2, 10, 17, 34, 50]),
  // SO2 24-hr µg/m³ — R Table 3.11: 0–40, 41–80, 81–380, 381–800, 801–1600, 1600+. Severe top 2620: X (convention).
  so2: segments([40, 80, 380, 800, 1600, 2620]),
};

/**
 * R Table 3.11 footnote on the O3 209–748 and 748+ bands: above 208 µg/m³
 * (8-hour), the sub-index uses the 1-hour value ("one hourly monitoring, for
 * mathematical calculation only"; X states it as this switch).
 */
export const O3_ONE_HOUR_SWITCH_UGM3 = 208;

/**
 * Sub-index for one pollutant (R §3.5, PDF p.39):
 * I = ((I_HI − I_LO) / (BP_HI − BP_LO)) × (C − BP_LO) + I_LO.
 * Unrounded. Above the Severe upper bound it caps at 500. Invalid input -> null.
 */
export function subIndex(pollutant: Pollutant, concentration: number): number | null {
  if (!Number.isFinite(concentration) || concentration < 0) return null;
  const segment = BREAKPOINTS[pollutant].find(({ cHi }) => concentration <= cHi);
  if (!segment) return 500;
  const { cLo, cHi, iLo, iHi } = segment;
  return ((iHi - iLo) / (cHi - cLo)) * (concentration - cLo) + iLo;
}
