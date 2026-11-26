# Architecture — Breathwise

## 1. Overview

Breathwise is a static React SPA on Cloudflare Pages with one Pages Function (`/api/advise`) that keeps the Gemini key server-side. All environmental data is fetched **directly from the browser** from free, CORS-enabled, keyless APIs.

```
┌─────────────────────────────── Browser (React SPA) ───────────────────────────────┐
│                                                                                    │
│  features/location ──► { lat, lon, name, state }                                   │
│      ├─ navigator.geolocation                                                      │
│      ├─ BigDataCloud reverse-geocode-client                                        │
│      └─ Open-Meteo Geocoding (countryCode=IN)                                      │
│                                                                                    │
│  features/airquality ─┐   (parallel, TanStack Query, staleTime 15 min)             │
│  features/weather ────┴─► raw responses ─► Zod parse                               │
│                                                                                    │
│  lib/aqi      computeNaqi(), rollingAverages()                                     │
│  lib/rules    hourlyBands(), findBestWindows(), ventilationWindows(), trend(),     │
│               memberRisk()                                                         │
│  lib/impact   commuteEmissions()                                                   │
│  lib/snapshot buildFactsSnapshot(aq, weather, location, profile) ─► FactsSnapshot  │
│                                                                                    │
│  features/profile  (localStorage, Zod-validated)                                   │
│                                                                                    │
│  features/advice                                                                   │
│     transport = proxy (default) | byok (sessionStorage key)                        │
│     ├─ proxy: POST /api/advise { mode, snapshot, ... }                             │
│     └─ byok : shared/advice/gemini.ts → Gemini REST directly                       │
│     ─► AdvicePlan (Zod) ─► groundingGuard ─► UI   | on failure ─► fallbackPlan()   │
└────────────────────────────────────────────────────────────────────────────────────┘
                                   │ POST /api/advise
                                   ▼
┌──────────────────── Cloudflare Pages Function: functions/api/advise.ts ────────────┐
│  origin check → size cap → Zod(AdviceRequest) → rate limit (KV) →                  │
│  shared/advice/prompt.ts → shared/advice/gemini.ts (REST, x-goog-api-key) →         │
│  Zod(AdvicePlan | ChatAnswer) → JSON response                                       │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Core principle: code computes, AI interprets

| Concern | Owner |
|---|---|
| Pollutant values, US AQI | Open-Meteo (live) |
| India AQI, categories, dominant pollutant | `lib/aqi` (pure TS) |
| Best/worst hours, ventilation windows, trend | `lib/rules` (pure TS) |
| Per-member risk level | `lib/rules/memberRisk.ts` (pure TS) |
| CO₂ savings | `lib/impact` (pure TS, cited factors) |
| Choosing & phrasing actions, explaining *why*, tailoring to household | Gemini |
| Fallback actions when AI unavailable | `features/advice/fallbackPlan.ts` (pure TS) |

## 3. Folder structure

```
breathwise/
├─ CLAUDE.md
├─ README.md
├─ docs/
├─ functions/
│  └─ api/
│     └─ advise.ts              # Pages Function: proxy to Gemini
├─ shared/                      # imported by both SPA and Function (no DOM, no React)
│  ├─ config.ts                 # DEFAULT_MODEL, limits, timeouts
│  ├─ types.ts                  # FactsSnapshot, Persona, Member, etc.
│  └─ advice/
│     ├─ requestSchema.ts       # Zod AdviceRequest
│     ├─ planSchema.ts          # Zod AdvicePlan + JSON schema for Gemini
│     ├─ chatSchema.ts          # Zod ChatAnswer + JSON schema
│     ├─ prompt.ts              # system prompts + builders
│     ├─ gemini.ts              # REST call, timeout, JSON extraction
│     └─ groundingGuard.ts      # numeric grounding check
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ providers.tsx          # QueryClient, stores, theme
│  │  └─ ErrorBoundary.tsx
│  ├─ features/
│  │  ├─ location/              # useCurrentPosition, reverseGeocode, LocationSearch, LocationBar
│  │  ├─ airquality/            # api.ts, schemas.ts, useAirQuality, LiveAqiCard, PollutantGrid,
│  │  │                         # FreshnessBar, ForecastTimeline, ForecastTable
│  │  ├─ weather/               # api.ts, schemas.ts, useWeather, WeatherStrip
│  │  ├─ profile/               # profileStore, profileSchema, Onboarding/*, ProfileSheet, scenarios.ts
│  │  ├─ advice/                # useAdvice, transport.ts, fallbackPlan.ts, PlanTabs, ActionCard
│  │  ├─ chat/                  # useChat, ChatPanel
│  │  └─ settings/              # settingsStore, SettingsSheet, ByokField, LanguageSelect
│  ├─ lib/
│  │  ├─ aqi/                   # breakpoints.ts, naqi.ts, averages.ts, categories.ts
│  │  ├─ rules/                 # bands.ts, windows.ts, ventilation.ts, trend.ts, memberRisk.ts, thresholds.ts
│  │  ├─ impact/                # emissionFactors.ts, commuteEmissions.ts
│  │  ├─ snapshot.ts
│  │  ├─ time.ts
│  │  ├─ hash.ts                # stable profile hash for cache keys
│  │  └─ storage.ts             # safe localStorage/sessionStorage wrappers
│  ├─ components/
│  │  ├─ ui/                    # Button, Card, Tabs, Sheet, Badge, Spinner, VisuallyHidden …
│  │  └─ layout/                # Header, Footer (attribution), SkipLink
│  └─ styles/
│     └─ index.css              # Tailwind + design tokens
├─ public/
│  ├─ _headers                  # security headers + CSP
│  └─ favicon.svg
├─ scripts/
│  └─ capture-fixtures.mjs      # records real API responses into tests/fixtures (dev only)
├─ tests/
│  ├─ fixtures/                 # captured real API responses (TEST ONLY)
│  ├─ msw/                      # handlers + server setup (TEST ONLY)
│  ├─ unit/                     # mirrors src/lib and shared
│  ├─ components/
│  └─ e2e/                      # Playwright specs + axe
├─ wrangler.toml                # pages_build_output_dir, KV binding, vars
├─ .dev.vars.example
├─ .env.example
├─ .github/workflows/ci.yml
└─ (vite, ts, eslint, prettier, playwright, vitest configs)
```

ESLint `no-restricted-imports` blocks `tests/**` from `src/**`, `shared/**`, `functions/**`.

## 4. Key types (in `shared/types.ts`)

```ts
export type Persona = 'parent' | 'senior' | 'commuter' | 'student';
export type AgeBand = 'infant_0_1' | 'child_2_5' | 'child_6_12' | 'teen_13_17' | 'adult_18_59' | 'senior_60_plus';
export type Condition = 'asthma' | 'copd' | 'heart_disease' | 'pregnancy' | 'allergies' | 'diabetes';
export type NaqiCategory = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
export type RiskLevel = 'low' | 'caution' | 'high' | 'very_high';

export interface Member {
  id: string;
  label: string;            // "Aarav (4)", "Dad" – user-entered, never sent beyond the AI call
  ageBand: AgeBand;
  conditions: Condition[];
  outdoorActivity?: { kind: 'play' | 'walk' | 'run' | 'sport' | 'yoga'; usualStart: string /* HH:mm */; durationMin: number };
}

export interface HouseholdProfile {
  personas: Persona[];
  members: Member[];
  commute?: { mode: 'walk' | 'cycle' | 'two_wheeler' | 'car_petrol' | 'car_diesel' | 'car_cng' | 'auto_rickshaw' | 'bus' | 'metro' | 'wfh';
              departs?: string; returns?: string; oneWayKm?: number; daysPerWeek?: number };
  home?: { type: 'apartment' | 'independent' | 'hostel'; purifier?: { has: boolean; cadrM3h?: number; roomM2?: number };
           ac?: boolean; cookingFuel?: 'lpg' | 'png' | 'electric' | 'biomass' | 'kerosene' };
  masks: Array<'n95_ffp2' | 'surgical' | 'cloth' | 'none'>;
  language: 'en' | 'hi' | 'bn' | 'ta' | 'mr';
}

export interface Window { start: string; end: string; avgPm25Ugm3: number; band: NaqiCategory; label: string /* "W1" */ }

export interface FactsSnapshot {
  version: 1;
  location: { name: string; state?: string; latRounded: number; lonRounded: number; timezone: string };
  provenance: { source: string; model: string; readingTime: string; fetchedAt: string; isModelledEstimate: true };
  current: { pm25Ugm3: number; pm10Ugm3: number; no2Ugm3: number; so2Ugm3: number; o3Ugm3: number; coMgm3: number; usAqi?: number; dustUgm3?: number; uvIndex?: number };
  naqi: { value: number; category: NaqiCategory; dominant: string; subIndices: Record<string, number>; hoursUsed: number; isEstimate: true } | null;
  trend: 'rising' | 'falling' | 'steady';
  weather: { tempC: number; humidityPct: number; windKmh: number; windDirDeg: number; precipProbPct?: number };
  windows: { bestOutdoor: Window[]; ventilate: Window[]; worst: Window[] };
  memberRisk: Array<{ memberId: string; level: RiskLevel; reasons: string[] }>;
  impactFacts: Array<{ id: string; description: string; kgCo2PerWeek: number; source: string }>;
  comparisons: Array<{ id: string; text: string; value: number; unit: string }>; // e.g. best-window PM2.5 vs now, % lower
  profile: HouseholdProfile;
}
```

Every number the AI may mention appears somewhere in `FactsSnapshot` — that is what the grounding guard checks against.

## 5. Data flow & caching

| Step | Trigger | Cache |
|---|---|---|
| Geocode search | typing (300 ms debounce, ≥ 2 chars) | Query cache 24 h |
| Reverse geocode | GPS success | Query cache 24 h keyed by rounded lat/lon |
| AQ + weather | location change, 15 min interval while tab visible, manual refresh | `staleTime` 15 min, `gcTime` 60 min |
| Snapshot | derived (memoised) | — |
| AI plan | first view per key, or "Regenerate" | memory + `sessionStorage`, key = `hash(lat2,lon2, readingHour, profileHash, language)` |
| AI chat | user submit | none |

AQ and weather queries run in parallel; the snapshot is built only when both have resolved (weather is optional — snapshot still builds without it, with `weather` fields omitted and noted).

## 6. Error handling & degradation

| Failure | Behaviour |
|---|---|
| Geolocation denied/timeout | Message + focus moves to search |
| Reverse geocode fails (or returns no country) | If the coordinates are inside the rough India bounding box (lat 6–37.5, lon 68–97.5): show "Near 28.61, 77.21 (place name unavailable)", keep the search box visible and continue. Outside the box: show the India-only message (ADR-010) |
| AQ API fails | Error card with retry; no plan generated; never show old data without a "stale" badge |
| AQ reading older than 90 min | "Stale" badge. Measured from the **reading time** (`current.time`, hourly for India), not the fetch time |
| Weather API fails | Continue without weather; note in UI and snapshot |
| NAQI insufficient data (< 3 pollutants or < 16 h for 24 h averages) | Show "India AQI unavailable" + US AQI; rules still run on PM2.5 |
| `/api/advise` 429 | "Too many requests, try again in a minute" + fallback plan |
| `/api/advise` 5xx / timeout / invalid JSON | One retry, then fallback plan with notice |
| Grounding guard fails twice | Fallback plan with notice |
| BYOK key invalid (401/403) | Clear inline error in Settings |

## 7. Performance

- Route-level split: Onboarding and Dashboard are separate chunks; Chat panel lazily loaded.
- No chart library: timeline is a CSS grid of hour cells (+ table alternative).
- Self-hosted fonts (`@fontsource-variable/*`), `font-display: swap`.
- Only request the variables we use from Open-Meteo.
- Bundle budget enforced in CI (`vite build` + size check script).
