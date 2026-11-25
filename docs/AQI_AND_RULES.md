# AQI & Rules Engine — Breathwise

Everything in this document is implemented as **pure, deterministic, unit-tested TypeScript** in `src/lib/aqi`, `src/lib/rules`, and `src/lib/impact`. No AI is involved.

> Before finalising `breakpoints.ts`, cross-check every value against CPCB's *National Air Quality Index* technical document (2014) and record the reference in a code comment.

## 1. India National AQI (NAQI)

### 1.1 Categories

| Index | Category | Colour token | Health statement (paraphrased from CPCB) |
|---|---|---|---|
| 0–50 | Good | `aqi-good` | Minimal impact |
| 51–100 | Satisfactory | `aqi-satisfactory` | Minor breathing discomfort for sensitive people |
| 101–200 | Moderate | `aqi-moderate` | Breathing discomfort for people with lung disease (e.g. asthma), heart disease, children and older adults |
| 201–300 | Poor | `aqi-poor` | Breathing discomfort for most people on prolonged exposure |
| 301–400 | Very Poor | `aqi-very-poor` | Respiratory illness on prolonged exposure |
| 401–500 | Severe | `aqi-severe` | Affects healthy people; serious impact on those with existing disease |

### 1.2 Breakpoints (concentration ranges per sub-index band)

| Band (index) | PM10 24h µg/m³ | PM2.5 24h µg/m³ | NO₂ 24h µg/m³ | O₃ 8h µg/m³ | CO 8h mg/m³ | SO₂ 24h µg/m³ |
|---|---|---|---|---|---|---|
| 0–50 | 0–50 | 0–30 | 0–40 | 0–50 | 0–1.0 | 0–40 |
| 51–100 | 51–100 | 31–60 | 41–80 | 51–100 | 1.1–2.0 | 41–80 |
| 101–200 | 101–250 | 61–90 | 81–180 | 101–168 | 2.1–10 | 81–380 |
| 201–300 | 251–350 | 91–120 | 181–280 | 169–208 | 10.1–17 | 381–800 |
| 301–400 | 351–430 | 121–250 | 281–400 | 209–748 | 17.1–34 | 801–1600 |
| 401–500 | 430+ | 250+ | 400+ | 748+ | 34+ | 1600+ |

**Severe-band upper bounds** (needed for interpolation; values commonly used by open implementations — verify): PM10 510, PM2.5 380, NO₂ 520, O₃ 1000, CO 51, SO₂ 2400. Concentrations above the upper bound → sub-index capped at 500.

### 1.3 Sub-index formula

Treat bands as continuous ranges `[BPlo, BPhi] → [Ilo, Ihi]` (use the lower band's upper edge as the next band's lower edge to avoid gaps, e.g. PM2.5 30→60 maps to 50→100):

```
I = ((Ihi − Ilo) / (BPhi − BPlo)) × (C − BPlo) + Ilo
```

Round the final index to the nearest integer.

### 1.4 Averaging (`averages.ts`)

- From `hourly` arrays, take the window ending at the current hour (inclusive).
- PM10, PM2.5, NO₂, SO₂: **24-hour mean**; valid only if ≥ 16 non-null hours.
- O₃, CO: **8-hour mean** (CPCB uses max 8-h for daily; for a "now" estimate use the latest 8-h mean); valid only if ≥ 6 non-null hours.
- CO: convert µg/m³ → mg/m³ (`/ 1000`) before applying breakpoints.

### 1.5 Overall NAQI (`naqi.ts`)

```
computeNaqi(averages) → { value, category, dominant, subIndices, hoursUsed } | null
```

- Valid only if **≥ 3 pollutants** have valid sub-indices **and at least one is PM2.5 or PM10**; otherwise return `null`.
- `value = max(subIndices)`; `dominant = argmax`.
- UI label: "India AQI (estimated)".

### 1.6 Required tests

- Each band boundary for each pollutant (e.g. PM2.5 30 → 50, 60 → 100, 90 → 200, 120 → 300, 250 → 400).
- Mid-band interpolation (PM2.5 45 → 75).
- Cap at 500.
- CO unit conversion (2500 µg/m³ → 2.5 mg/m³ → index ≈ 106).
- Insufficient-data cases return `null`.
- Null handling in hourly arrays.

## 2. Hourly bands (`rules/bands.ts`)

For the timeline and windows we need an **hourly** signal. Use **hourly PM2.5** mapped through the PM2.5 breakpoints to a band. Label in UI as "PM2.5 level" — *not* NAQI (NAQI is a 24-h measure).

## 3. Trend (`rules/trend.ts`)

Compare mean PM2.5 of the next 3 hours vs previous 3 hours:
- `> +10%` → `rising`; `< −10%` → `falling`; else `steady`.

## 4. Best outdoor windows (`rules/windows.ts`)

```
findBestWindows(hourly, { from: now, horizonH: 24, durationH, wakingHours: [6, 21], maxResults: 2 })
```

- Slide a window of `durationH` (from the member's activity duration, rounded up to whole hours; default 1) across waking hours within the next 24 h.
- Score = mean PM2.5 of the window. Return the lowest-scoring non-overlapping windows, labelled `W1`, `W2`.
- Also compute `worst` = highest-scoring 2 windows (to tell users what to avoid).
- Add a comparison fact: `% lower PM2.5 in W1 vs the member's usual time` (or vs now if no usual time).

## 5. Ventilation windows (`rules/ventilation.ts`)

- Candidates: waking hours in next 24 h.
- Pick up to 2 windows of 15–30 min advice, anchored to the **lowest outdoor PM2.5 hours**, preferring hours with wind ≥ 8 km/h (better dispersion) when weather is available.
- If every candidate hour is in **Very Poor/Severe** PM2.5 band, return `[]` and the plan says "keep windows closed; rely on purifier; ventilate kitchen with exhaust only while cooking".

## 6. Persona thresholds & member risk (`rules/thresholds.ts`, `rules/memberRisk.ts`)

Sensitive member = age band `infant_0_1`, `child_2_5`, `child_6_12`, `senior_60_plus`, **or** any condition.

| NAQI category | General adult | Sensitive member |
|---|---|---|
| Good | low | low |
| Satisfactory | low | caution |
| Moderate | caution | high |
| Poor | high | very_high |
| Very Poor | very_high | very_high |
| Severe | very_high | very_high |

Outdoor exertion guidance by risk (used by fallback plan and passed as facts to AI):

| Risk | Outdoor activity guidance |
|---|---|
| low | Normal activity |
| caution | Prefer lighter exertion; use best window |
| high | Short, light activity only in W1; consider indoor alternative |
| very_high | Move activity indoors; essential trips only with a well-fitted N95/FFP2 (adults) |

Mask rules (facts, not AI judgement):
- N95/FFP2 well-fitted is the effective option for PM2.5; surgical/cloth offer limited protection against fine particles.
- No masks for infants/children under 2.
- People with heart/lung conditions should consult their doctor about respirator use.

Each member's `reasons[]` lists short machine-generated strings (e.g. `"sensitive:age_child_2_5"`, `"condition:asthma"`, `"category:poor"`).

## 7. Purifier guidance facts

- Rule of thumb: target ≈ **4–5 air changes per hour**. `requiredCadrM3h = roomM2 × ceilingHeightM (default 2.8) × 5`.
- If the user's `cadrM3h` is known, compute `achievedAch = cadrM3h / (roomM2 × 2.8)` and include it as a comparison fact.
- If no purifier: facts include "no purifier" so AI suggests sealing, a single "clean room", and DIY box-fan + filter only as a clearly-labelled low-cost option.

## 8. Emissions (`lib/impact`)

`commuteEmissions(profile.commute)` returns weekly kg CO₂ for the current mode and alternatives (carpool with 2 and 3 occupants, bus, metro, WFH one extra day).

```
weeklyKg = factorKgPerKm × oneWayKm × 2 × daysPerWeek / occupants
```

`emissionFactors.ts` must contain each factor **with a source string and URL**. Use India-specific factors where available (e.g. India GHG Program, *India Specific Road Transport Emission Factors*). Indicative values to verify before use:

| Mode | kg CO₂ / passenger-km (indicative) |
|---|---|
| Petrol car (small) | ~0.13–0.15 |
| Diesel car | ~0.14–0.16 |
| CNG car | ~0.10–0.12 |
| Two-wheeler (petrol) | ~0.03–0.05 |
| Auto-rickshaw (CNG) | ~0.05–0.07 |
| Bus (per passenger) | ~0.015–0.03 |
| Metro (per passenger) | ~0.01–0.02 |
| Walk / cycle / WFH | 0 |

Output each saving as an `impactFacts[]` entry with `source`. The AI may cite these numbers; it may not compute new ones.

## 9. Fallback plan (`features/advice/fallbackPlan.ts`)

Deterministic plan with the same `AdvicePlan` shape, built from: member risk table, windows, ventilation windows, purifier facts, mask rules, and impact facts. Copy is template-based, plain and short. Shown when AI is unavailable, with the notice "Personalised AI plan unavailable — showing standard guidance based on live data."
