import type { CommuteMode } from '@shared/types';

/**
 * CO2 emission factors for commute modes (AQI_AND_RULES.md §8).
 *
 * Road factors: India GHG Program (WRI India, CII, TERI), "India Specific Road
 * Transport Emission Factors", 2015, Version 1.0 "For Stakeholder
 * Consultation" (the only version published). Road factors are TAILPIPE ONLY
 * (fuel combustion). Metro counts power-generation emissions instead, so the
 * two are not like-for-like system boundaries.
 */
export interface EmissionFactor {
  kgCo2PerKm: number;
  /**
   * vehicle_km: divide by occupants for a per-person figure.
   * passenger_km: already per person (average real loads), never divided.
   */
  basis: 'vehicle_km' | 'passenger_km' | 'none';
  description: string;
  source: string;
  sourceUrl: string;
  note?: string;
}

const INDIA_GHG_ROAD =
  'India GHG Program, India Specific Road Transport Emission Factors (2015, v1.0 for stakeholder consultation)';
const INDIA_GHG_ROAD_URL =
  'https://indiaghgp.org/sites/default/files/Road%20Transport%20Technical%20Paper.pdf';
const NO_DIRECT_EMISSIONS_URL =
  'https://github.com/joedanields/Breathwise/blob/main/docs/AQI_AND_RULES.md#8-emissions';

/**
 * Metro energy intensity, back-calculated: UNEP-DTU / IIT Delhi, "Promoting Low
 * Carbon Transport in India: Case Study of Metro Rails in Indian Cities"
 * (Goel & Tiwari, June 2014), PDF p.49, gives 61 g CO2e/pkm for the Delhi Metro
 * (FY 2010-11) from a 0.943 kg/kWh grid factor and does not state kWh/pkm
 * directly, so kWh/pkm = 0.061 / 0.943 ≈ 0.0647. This includes the study's 32 %
 * transmission-and-distribution gross-up (kWh at the power station per pkm).
 * https://unepccc.org/wp-content/uploads/2014/08/case-study-of-metro-final.pdf
 */
export const METRO_KWH_PER_PKM = 0.061 / 0.943;

/**
 * All-India grid, weighted average by net generation (incl. RE and captive
 * injection), FY 2025-26: CEA "CO2 Baseline Database for the Indian Power
 * Sector", User Guide Version 22.0 (August 2026), Table S (PDF p.6): 0.675 tCO2/MWh.
 * https://cea.nic.in/api/cdm-report-version/view-pdf/en/82
 */
export const CEA_GRID_KG_CO2_PER_KWH = 0.675;
const CEA_URL = 'https://cea.nic.in/api/cdm-report-version/view-pdf/en/82';

export const EMISSION_FACTORS: Readonly<Record<CommuteMode, EmissionFactor>> = {
  // India GHG road paper §5.3.1 row 5, Hatchback <1400 CC Gasoline, with 8 % uplift (PDF p.30; summary PDF p.11).
  car_petrol: {
    kgCo2PerKm: 0.14,
    basis: 'vehicle_km',
    description: 'Petrol hatchback (<1400 cc), per vehicle-km',
    source: `${INDIA_GHG_ROAD}, §5.3.1 row 5 (PDF p.30)`,
    sourceUrl: INDIA_GHG_ROAD_URL,
    note: 'Tailpipe only.',
  },
  // §5.3.1 row 23, Hatchback <1400 CC Diesel, with 8 % uplift (PDF p.30).
  car_diesel: {
    kgCo2PerKm: 0.126,
    basis: 'vehicle_km',
    description: 'Diesel hatchback (<1400 cc), per vehicle-km',
    source: `${INDIA_GHG_ROAD}, §5.3.1 row 23 (PDF p.30)`,
    sourceUrl: INDIA_GHG_ROAD_URL,
    note: 'Tailpipe only.',
  },
  // §5.3.1 row 2, Small <800 CC CNG, with 8 % uplift (PDF p.30) — the paper's only CNG car row.
  car_cng: {
    kgCo2PerKm: 0.068,
    basis: 'vehicle_km',
    description: 'CNG small car (<800 cc), per vehicle-km',
    source: `${INDIA_GHG_ROAD}, §5.3.1 row 2 (PDF p.30)`,
    sourceUrl: INDIA_GHG_ROAD_URL,
    note: 'Tailpipe only. The only CNG car row is a <800 cc small car, while the petrol and diesel rows are <1400 cc hatchbacks, so CNG savings vs petrol are overstated by the class difference.',
  },
  // §5.1.1, Scooter <110 CC, with 10 % uplift (PDF p.26, printed p.24). Columns are misaligned
  // in the PDF text; mapping confirmed by every row satisfying uplifted = base × 1.10.
  two_wheeler: {
    kgCo2PerKm: 0.0368,
    basis: 'vehicle_km',
    description: 'Petrol scooter (<110 cc), per vehicle-km',
    source: `${INDIA_GHG_ROAD}, §5.1.1 Scooter <110 CC (PDF p.26)`,
    sourceUrl: INDIA_GHG_ROAD_URL,
    note: 'Tailpipe only.',
  },
  // §5.2.1, Three wheeler CNG (PDF p.28, printed p.26). The paper applies no uplift to three-wheelers.
  auto_rickshaw: {
    kgCo2PerKm: 0.10768,
    basis: 'vehicle_km',
    description:
      'CNG auto-rickshaw, per vehicle-km (one hiring passenger; empty return trips ignored)',
    source: `${INDIA_GHG_ROAD}, §5.2.1 CNG (PDF p.28)`,
    sourceUrl: INDIA_GHG_ROAD_URL,
    note: 'Tailpipe only.',
  },
  // §5.4.1, intra-city bus, weighted by state transport undertakings' passenger-km (PDF p.32, printed p.30).
  bus: {
    kgCo2PerKm: 0.015161,
    basis: 'passenger_km',
    description: 'Intra-city bus, per passenger-km (not BRTS or intercity)',
    source: `${INDIA_GHG_ROAD}, §5.4.1 (PDF p.32)`,
    sourceUrl: INDIA_GHG_ROAD_URL,
    note: 'Tailpipe only.',
  },
  // Computed: METRO_KWH_PER_PKM × CEA_GRID_KG_CO2_PER_KWH ≈ 0.0437 kg CO2/pkm.
  metro: {
    kgCo2PerKm: METRO_KWH_PER_PKM * CEA_GRID_KG_CO2_PER_KWH,
    basis: 'passenger_km',
    description: 'Metro rail, per passenger-km',
    source:
      'UNEP-DTU/IIT Delhi metro case study (2014) p.49, energy intensity back-calculated (0.061 ÷ 0.943 kWh/pkm) × CEA CO2 Baseline Database v22.0 (Aug 2026) Table S, FY 2025-26 weighted average 0.675 tCO2/MWh',
    sourceUrl: 'https://unepccc.org/wp-content/uploads/2014/08/case-study-of-metro-final.pdf',
    note: `Counts power-generation emissions (grid factor: ${CEA_URL}), while road factors are tailpipe only. Ridership and energy use are Delhi Metro FY 2010-11.`,
  },
  walk: {
    kgCo2PerKm: 0,
    basis: 'none',
    description: 'Walking',
    source: 'No direct emissions (human-powered)',
    sourceUrl: NO_DIRECT_EMISSIONS_URL,
  },
  cycle: {
    kgCo2PerKm: 0,
    basis: 'none',
    description: 'Cycling',
    source: 'No direct emissions (human-powered)',
    sourceUrl: NO_DIRECT_EMISSIONS_URL,
  },
  wfh: {
    kgCo2PerKm: 0,
    basis: 'none',
    description: 'Working from home (no commute)',
    source: 'No commute, so no commute emissions',
    sourceUrl: NO_DIRECT_EMISSIONS_URL,
  },
};
