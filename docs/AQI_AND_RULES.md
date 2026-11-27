# AQI & Rules Engine — Breathwise

Everything in this document is implemented as **pure, deterministic, unit-tested TypeScript** in `src/lib/aqi`, `src/lib/rules`, `src/lib/impact` and `src/lib/snapshot.ts`. No AI is involved, and no module reads the clock: "now" is passed in.

## 0. Sources and status

Every value below carries a **Source status**:

- **verified (R/H)**: checked against a primary CPCB document.
- **CPCB-adjacent (X)**: from a file on a CPCB domain that is not itself primary.
- **Breathwise convention**: our own choice, where no source gives a rule. Conventions say so in code comments too.

Non-CPCB values (emission factors, exposure ratios) are marked **verified** against the primary source named in the row.

| Key | Source | Where |
|---|---|---|
| R | CPCB, *National Air Quality Index*, Control of Urban Pollution Series CUPS/82/2014-15 (final report) | [cpcb.gov.in …FINAL-REPORT_AQI_.pdf](https://cpcb.gov.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvRklOQUwtUkVQT1JUX0FRSV8ucGRm) |
| H | CPCB, *How is AQI calculated?* (2015) | [airquality.cpcb.gov.in/ccr_docs/How_AQI_Calculated.pdf](https://airquality.cpcb.gov.in/ccr_docs/How_AQI_Calculated.pdf) |
| X | "AQI Calculator" spreadsheet on CPCB's CCR site. Its file properties show it was made in 2026 with openpyxl/LibreOffice: a reproduction, not CPCB's 2014 tool | [app.cpcbccr.com/ccr_docs/AQI-Calculator.xls](https://app.cpcbccr.com/ccr_docs/AQI-Calculator.xls) |
| G | India GHG Program, *India Specific Road Transport Emission Factors*, 2015, Version 1.0 "For Stakeholder Consultation" (the only version published) | [indiaghgp.org … Road Transport Technical Paper.pdf](https://indiaghgp.org/sites/default/files/Road%20Transport%20Technical%20Paper.pdf) |
| U | Goel & Tiwari (IIT Delhi), *Promoting Low Carbon Transport in India: Case Study of Metro Rails in Indian Cities*, UNEP-DTU, June 2014 | [unepccc.org … case-study-of-metro-final.pdf](https://unepccc.org/wp-content/uploads/2014/08/case-study-of-metro-final.pdf) |
| C | CEA, *CO2 Baseline Database for the Indian Power Sector*, User Guide Version 22.0, August 2026 | [cea.nic.in … view-pdf/en/82](https://cea.nic.in/api/cdm-report-version/view-pdf/en/82) |
| E | Goel, Gani, Guttikunda, Wilson & Tiwari (2015), *On-road PM2.5 pollution exposure in multiple transport microenvironments in Delhi*, Atmospheric Environment 123:129–138 | [urbanemissions.info … Delhi-On-Road-Exposures.pdf](https://urbanemissions.info/wp-content/uploads/docs/2015-12-AE-Delhi-On-Road-Exposures.pdf) |

Values were checked on 2026-11-27. CPCB's own `cpcb.nic.in` pages failed TLS certificate verification, so R was read from `cpcb.gov.in`.

## 1. India National AQI (NAQI)

### 1.1 Categories

| Index | Category | Colour token | Health statement (paraphrased) | Source status |
|---|---|---|---|---|
| 0–50 | Good | `aqi-good` | Minimal impact | verified (R Table 3.11, 3.12) |
| 51–100 | Satisfactory | `aqi-satisfactory` | Minor breathing discomfort for sensitive people | verified (R) |
| 101–200 | Moderate | `aqi-moderate` | Breathing discomfort for people with lung disease (e.g. asthma), heart disease, children and older adults | verified (R) |
| 201–300 | Poor | `aqi-poor` | Breathing discomfort for most people on prolonged exposure | verified (R) |
| 301–400 | Very Poor | `aqi-very-poor` | Respiratory illness on prolonged exposure | verified (R) |
| 401–500 | Severe | `aqi-severe` | Affects healthy people; serious impact on those with existing disease | verified (R) |

The index is rounded to an integer before the category is chosen (50 → Good, 51 → Satisfactory). Breathwise convention.

### 1.2 Breakpoints (`src/lib/aqi/breakpoints.ts`)

| Band (index) | PM10 24h µg/m³ | PM2.5 24h µg/m³ | NO₂ 24h µg/m³ | O₃ 8h µg/m³ | CO 8h mg/m³ | SO₂ 24h µg/m³ | Source status |
|---|---|---|---|---|---|---|---|
| 0–50 | 0–50 | 0–30 | 0–40 | 0–50 | 0–1.0 | 0–40 | verified (R Table 3.11, PDF p.37) |
| 51–100 | 51–100 | 31–60 | 41–80 | 51–100 | 1.1–2.0 | 41–80 | verified (R Table 3.11) |
| 101–200 | 101–250 | 61–90 | 81–180 | 101–168 | 2.1–10 | 81–380 | verified (R Table 3.11) |
| 201–300 | 251–350 | 91–120 | 181–280 | 169–208 | 10.1–17 | 381–800 | verified (R Table 3.11) |
| 301–400 | 351–430 | 121–250 | 281–400 | 209–748* | 17.1–34 | 801–1600 | verified (R Table 3.11) |
| 401–500 | 430+ | 250+ | 400+ | 748+* | 34+ | 1600+ | verified (R Table 3.11) |
| Severe upper bound (index 500) | 510 | 380 | 520 | 1000 | 50 | 2620 | CPCB-adjacent (X, "Breakpoints" sheet band 6); not published by CPCB |

\* R's footnote: "One hourly monitoring (for mathematical calculation only)". X states the rule: when the 8-hour O₃ average exceeds **208 µg/m³**, the sub-index uses the **1-hour** value. Breathwise applies this with the current hour's O₃. If there is no 1-hour value, it keeps the 8-hour value and records `o3Basis` in the snapshot.

R leaves the Severe band open-ended. The upper bounds only decide the number within 401–500; the Severe category does not depend on them. Concentrations above the upper bound give a sub-index of **500**.

### 1.3 Sub-index formula (`subIndex`)

| Rule | Source status |
|---|---|
| `I = ((I_HI − I_LO) / (BP_HI − BP_LO)) × (C − BP_LO) + I_LO` | verified (R §3.5, PDF p.39; H) |
| Bands are continuous: each starts at the previous band's published upper edge (PM2.5 30→60 maps to 50→100), so modelled values like 30.4 µg/m³ fall inside a band | Breathwise convention. Follows R §3.5's "subtract one from I_LO if I_LO > 50"; can differ by 1 from X's integer-band example at the very start of a band (PM2.5 31 → 52 here, 51 in X) |
| CPCB worked examples reproduced: PM2.5 45 → 75, 60 → 100 | verified (X example; R formula) |
| Concentrations are not truncated before applying the formula | Breathwise convention (X mentions "truncated concentration"; R does not) |
| Final index rounded to the nearest integer, capped at 500 | Breathwise convention |

### 1.4 Averaging (`src/lib/aqi/averages.ts`)

| Rule | Source status |
|---|---|
| PM10, PM2.5, NO₂, SO₂: 24-hour mean | verified (H item 1; R Table 3.11 header) |
| O₃, CO: 8-hour mean | verified (H item 1; R Table 3.11 header) |
| Window ends at the current hour, inclusive ("running average": AQI at 6 am uses data from 6 am the previous day) | verified (H item 4) |
| A sub-index needs ≥ 16 valid hours of 24 | verified (H item 2; R §3.7, PDF p.46) |
| O₃ and CO use the **latest** 8-hour mean and need ≥ 6 valid hours of 8 | Breathwise convention (CPCB gives no rule for 8-hour windows) |
| CO: µg/m³ ÷ 1000 → mg/m³ before applying breakpoints | verified (unit of R Table 3.11; Open-Meteo returns µg/m³) |
| Nulls are skipped, never treated as 0 | Breathwise convention (DATA_SOURCES.md §7) |

### 1.5 Overall NAQI (`src/lib/aqi/naqi.ts`)

```
computeNaqi(averages) → { value, category, dominant, subIndices, hoursUsed, o3Basis } | null
```

| Rule | Source status |
|---|---|
| Valid only with ≥ 3 pollutants that have valid sub-indices, at least one of them PM2.5 or PM10; otherwise `null` | verified (H item 2; R foreword and §3.7) |
| `value = max(sub-indices)`; that pollutant is the dominant one | verified (H item 1; R §3.5) |
| Ties go to the first pollutant in the order PM2.5, PM10, NO₂, O₃, CO, SO₂ | Breathwise convention |
| `hoursUsed` = fewest valid hours among the averages used | Breathwise convention |
| UI label: "India AQI (estimated)", because the inputs are modelled, not measured | Breathwise convention |

### 1.6 Tests (`tests/unit/lib/aqi/naqi.test.ts`)

- Every band edge for every pollutant (table-driven), mid-band interpolation, CPCB's 45 → 75 example.
- Cap at 500, invalid input → `null`.
- CO conversion (2500 µg/m³ → 2.5 mg/m³ → index ≈ 106).
- 16-of-24 and 6-of-8 sufficiency, nulls in hourly arrays.
- The < 3 pollutants and no-PM cases return `null`.
- Tie-breaks; the O₃ 1-hour switch above 208.

## 2. Hourly bands (`rules/bands.ts`)

| Rule | Source status |
|---|---|
| Hourly PM2.5 mapped through the PM2.5 breakpoints to a band, for timelines and windows | Breathwise convention (uses verified R breakpoints) |
| Labelled "PM2.5 level" in the UI, not NAQI (NAQI is a 24-hour measure) | Breathwise convention |

## 3. Trend (`rules/trend.ts`)

| Rule | Source status |
|---|---|
| Mean PM2.5 of the next 3 hours vs the previous 3 (current hour and the 2 before) | Breathwise convention |
| `> +10 %` rising, `< −10 %` falling, otherwise steady; exactly ±10 % is steady | Breathwise convention |
| Each side needs ≥ 2 of its 3 hours, otherwise `null` | Breathwise convention |

## 4. Best outdoor windows (`rules/windows.ts`)

```
findBestWindows(hourly, { fromIndex, horizonH: 24, durationH, wakingHours: [6, 21], maxResults: 2 })
```

| Rule | Source status |
|---|---|
| Windows start at the next full hour after "now" and stay within 24 h | Breathwise convention |
| Waking hours: start ≥ 06:00 and end ≤ 21:00, local time | Breathwise convention |
| Duration = longest member activity, rounded up to whole hours (default 1) | Breathwise convention |
| Score = mean PM2.5; windows containing a missing hour are skipped | Breathwise convention |
| Best = lowest, non-overlapping, labelled W1, W2; worst = highest, labelled X1, X2; ties go to the earlier start | Breathwise convention |
| Comparisons: % PM2.5 in W1 vs now, and vs each member's usual activity time; worded "lower", "higher" or "about the same" | Breathwise convention |

## 5. Ventilation windows (`rules/ventilation.ts`)

| Rule | Source status |
|---|---|
| Candidates: waking hours in the next 24 h; up to 2 one-hour slots, labelled V1, V2 (advice is 15–30 min of airing in the slot) | Breathwise convention |
| Very Poor and Severe PM2.5 hours never qualify; if none qualify, return `[]` and the plan says "keep windows closed; rely on purifier; ventilate kitchen with exhaust only while cooking" | Breathwise convention |
| Ranking: cleaner band first, then windy hours (≥ 8 km/h), then lower PM2.5, then earlier | Breathwise convention |

## 6. Persona thresholds & member risk (`rules/thresholds.ts`, `rules/memberRisk.ts`)

A sensitive member is one in age band `infant_0_1`, `child_2_5`, `child_6_12` or `senior_60_plus`, **or** with any condition.

| NAQI category | General adult | Sensitive member | Source status |
|---|---|---|---|
| Good | low | low | Breathwise convention (informed by R Table 3.12 health statements) |
| Satisfactory | low | caution | Breathwise convention |
| Moderate | caution | high | Breathwise convention |
| Poor | high | very_high | Breathwise convention |
| Very Poor | very_high | very_high | Breathwise convention |
| Severe | very_high | very_high | Breathwise convention |

When NAQI is unavailable, the current hour's PM2.5 band is used and `basis:pm25_hourly` is added to the reasons (ARCHITECTURE.md §6).

| Risk | Outdoor activity guidance | Source status |
|---|---|---|
| low | Normal activity | Breathwise convention |
| caution | Prefer lighter exertion; use the best window | Breathwise convention |
| high | Short, light activity only in W1; consider an indoor alternative | Breathwise convention |
| very_high | Move activity indoors; essential trips only with a well-fitted N95/FFP2 (adults) | Breathwise convention |

| Mask fact (not AI judgement) | Source status |
|---|---|
| A well-fitted N95/FFP2 is the effective option for PM2.5; surgical and cloth masks give limited protection against fine particles | Breathwise convention (general guidance) |
| No masks for infants or children under 2 | Breathwise convention (general guidance) |
| People with heart or lung conditions should ask their doctor about respirator use | Breathwise convention (general guidance) |

Each member's `reasons[]` lists short machine-generated strings (e.g. `"sensitive:age_child_2_5"`, `"condition:asthma"`, `"category:poor"`).

## 7. Purifier facts (`rules/purifier.ts`)

| Rule | Source status |
|---|---|
| Target ≈ 5 air changes per hour; `requiredCadrM3h = roomM2 × ceilingHeightM (2.8) × 5` | Breathwise convention (rule of thumb) |
| `achievedAch = cadrM3h / (roomM2 × 2.8)` as a comparison fact, 1 decimal | Breathwise convention |
| No purifier: `has: false`, so the AI suggests sealing, one "clean room", and a DIY box-fan + filter only as a clearly labelled low-cost option | Breathwise convention |

## 8. Emissions (`lib/impact`)

```
weeklyKg = factor × oneWayKm × 2 × daysPerWeek ÷ occupants     (vehicle-km factors only)
weeklyKg = factor × oneWayKm × 2 × daysPerWeek                 (passenger-km factors)
```

| Mode | Factor (kg CO₂/km) | Basis | Occupancy | Source | Source status |
|---|---|---|---|---|---|
| `car_petrol` | 0.140 | vehicle-km | ÷ occupants (current 1; carpool 2, 3) | G §5.3.1 row 5, hatchback <1400 cc petrol, 8 % uplift (PDF p.30) | verified (G) |
| `car_diesel` | 0.126 | vehicle-km | ÷ occupants | G §5.3.1 row 23, hatchback <1400 cc diesel, 8 % uplift (PDF p.30) | verified (G) |
| `car_cng` | 0.068 | vehicle-km | ÷ occupants | G §5.3.1 row 2, small <800 cc CNG, 8 % uplift (PDF p.30), the paper's only CNG car row | verified (G); **class caveat** below |
| `two_wheeler` | 0.0368 | vehicle-km | ÷ occupants (1) | G §5.1.1, scooter <110 cc, 10 % uplift (PDF p.26)† | verified (G) |
| `auto_rickshaw` | 0.10768 | vehicle-km | one hiring passenger; empty return trips ignored | G §5.2.1, CNG (PDF p.28); G applies no uplift to three-wheelers | verified (G); occupancy is Breathwise convention |
| `bus` | 0.015161 | passenger-km | none (actual passenger-km of state transport undertakings) | G §5.4.1, intra-city (PDF p.32); not BRTS or intercity | verified (G) |
| `metro` | ≈ 0.0437 = 0.0647 kWh/pkm × 0.675 kg/kWh | passenger-km | none (actual Delhi Metro ridership) | kWh/pkm back-calculated from U p.49 (61 g ÷ 0.943 kg/kWh; U gives no kWh/pkm directly; includes U's 32 % T&D gross-up) × C Table S, FY 2025-26 all-India weighted average 0.675 tCO₂/MWh (PDF p.6) | Breathwise convention (computed from verified U and C) |
| `walk`, `cycle`, `wfh` | 0 | — | — | No direct emissions | Breathwise convention |

† The two-wheeler table's columns are misaligned in the PDF text. Each "with uplift" value equals the base value × 1.10 (e.g. 0.0334 → 0.0368), which fixes the mapping.

**System-boundary caveat.** Road factors (G) are **tailpipe only**: fuel combustion in the vehicle. The metro factor counts **power-generation** emissions. The two are not like-for-like, so every metro impact fact says so ("Metro figures include power-station emissions; road figures count tailpipe only"). U's energy data is Delhi Metro FY 2010-11.

**CNG class caveat.** G's only CNG car row is a <800 cc small car, while the petrol and diesel rows are <1400 cc hatchbacks. CNG savings vs petrol are therefore **overstated** by the class difference.

### 8.1 Impact facts (`commuteImpactFacts`)

| Rule | Source status |
|---|---|
| Alternatives: carpool with 2 and 3 (cars only), bus, metro (unless current), working from home one more day | Breathwise convention |
| Each CO₂ fact carries `kgCo2PerWeek` and a **signed** `kgCo2PerWeekDelta` against the current mode: negative = saving, positive = increase, 0 = no change (rounded to 0.01 kg) | Breathwise convention |
| Descriptions never call an increase a saving: "would cut", "would add … so it is not a CO₂ saving", or "about the same" | Breathwise convention |
| No distance, no days, or already working from home → no facts | Breathwise convention |

### 8.2 Exposure benefit facts (`category: "exposureBenefit"`)

In-transit PM2.5 as a multiple of ambient, Delhi, morning rush hour (E, abstract and highlights, p.129):

| Mode | Ratio | Source status |
|---|---|---|
| walk | 1.4 | verified (E) |
| cycle | 1.1 | verified (E) |
| two_wheeler | 1.3 | verified (E) |
| auto_rickshaw | 1.3 | verified (E) |
| bus (AC or open-window) | 1.2 | verified (E) |
| metro carriage | 0.8 | verified (E) |
| car (AC 0.5, open window 1.3) | not used: the profile doesn't record AC | Breathwise convention |

| Rule | Source status |
|---|---|
| An exposure-benefit fact is added when the new mode was below ambient (ratio < 1, i.e. metro) and below the current mode, or when the trip is removed (WFH one more day) | Breathwise convention |
| No exposure benefit is claimed for buses: 1.2× is still above ambient | Breathwise convention, based on E |
| These facts let the AI make the health case when there is no CO₂ case (e.g. two-wheeler → metro adds CO₂ but cuts in-transit exposure) | Breathwise convention |

Output each fact as an `impactFacts[]` entry with `source` and `sourceUrl`. The AI may cite these numbers; it may not compute new ones.

## 9. Fallback plan (`features/advice/fallbackPlan.ts`)

Deterministic plan with the same `AdvicePlan` shape, built from: member risk table, windows, ventilation windows, purifier facts, mask rules, and impact facts. Copy is template-based, plain and short. Shown when AI is unavailable, with the notice "Personalised AI plan unavailable — showing standard guidance based on live data."
