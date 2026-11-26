# Test fixtures

**Tests only.** Runtime code (`src/`, `shared/`, `functions/`) must never import anything from here (ESLint `no-restricted-imports`). Tests load fixtures through [`index.ts`](index.ts), so a re-capture only changes the filenames in one place.

Rules (TESTING.md §2):

- Real responses are recorded as returned, with the capture date (IST) in the filename, and never edited or relabelled.
- When a test needs a condition the real data didn't show, a **derived** fixture is built from a real response by a documented transformation and named `*-derived-*`. Derived fixtures are for tests only and are never described as real readings.

## Real responses (captured 2026-11-26)

Open-Meteo responses come from `node scripts/capture-fixtures.mjs`, which imports the app's own request builders (`src/features/*/request.ts`), so the fixtures match the requests the app sends.

| File | Source | What the data shows |
|---|---|---|
| `aq-delhi-2026-11-26.json` | Air Quality API, 28.61, 77.21 | Reading 18:30 IST. Current PM2.5 103.4, PM10 104.8 µg/m³. Trailing 24 h mean (to 18:00): PM2.5 119.9, PM10 121.8 µg/m³, i.e. NAQI **Poor**, not severe. No nulls. |
| `aq-chennai-2026-11-26.json` | Air Quality API, 13.08, 80.27 | Reading 18:30 IST. Current PM2.5 7.4, PM10 9.5 µg/m³: a **clean** coastal day (NAQI Good), not moderate. No nulls. |
| `weather-delhi-2026-11-26.json` | Forecast API | 19.1 °C, 59 %, wind 5.1 km/h. Includes `boundary_layer_height`. |
| `weather-chennai-2026-11-26.json` | Forecast API | 27.1 °C, 84 %, wind 7.8 km/h. |
| `geo-search-lucknow-2026-11-26.json` | Geocoding API, `Lucknow` | One result. |
| `geo-search-pun-2026-11-26.json` | Geocoding API, `Pun` | Eight prefix matches (Pune first). Several have no `population`. |
| `geo-search-no-match-2026-11-26.json` | Geocoding API, `Qzxqzxq` | No `results` key at all. |
| `reverse-geocode-pune-2026-11-26.json` | BigDataCloud, 18.52, 73.86 | `countryCode: "IN"`, city Pune, Maharashtra. |
| `reverse-geocode-kathmandu-2026-11-26.json` | BigDataCloud, 27.72, 85.32 | `countryCode: "NP"`: the outside-India case. |

**BigDataCloud** is never called from Node or any script (its free endpoint is for browsers only). Both reverse-geocode files were opened in a browser by the project owner and pasted in by hand. The Pune paste was missing its opening `{`; that one character was restored and nothing else changed.

## Derived fixtures

Both are built by `scripts/capture-fixtures.mjs` from `aq-delhi-2026-11-26.json` in the same run. Hourly index 42 (`2026-11-26T18:00`) is the last hour at or before the reading time; the trailing 24-hour window is indices 19–42.

### `aq-derived-severe.json`

Delhi was **not** severe on the capture day, so this fixture scales Delhi's PM into the NAQI severe band (24 h PM2.5 > 250 or PM10 > 430 µg/m³):

- PM2.5: every hourly value and `current.pm2_5` multiplied by **2.503**, so the trailing 24 h mean becomes 300 µg/m³.
- PM10: every hourly value and `current.pm10` multiplied by **4.104**, so the trailing 24 h mean becomes 500 µg/m³.
- Results rounded to 1 decimal, like Open-Meteo. All other fields, including timestamps, other pollutants and **`us_aqi`, are unchanged**, so `us_aqi` no longer matches the PM values. Don't assert on US AQI with this fixture.

### `aq-derived-null-gaps.json`

Delhi had no nulls, so this fixture blanks values (sets them to `null`) to exercise missing-data handling:

| Field | Indices set to `null` | Effect |
|---|---|---|
| `hourly.pm2_5` | 22–27, 32, 35, 38, 41 (10 in the 24 h window) and 47, 48, 49 (forecast) | 14 valid hours in the window: **below** the 16-hour minimum for a 24 h average |
| `hourly.pm10` | 30, 34, 36, 40 | 20 valid hours: still enough for a 24 h average |
| `current.us_aqi`, `current.dust` | — | Missing current values |

Everything else is identical to the Delhi capture.

## Re-capturing

```bash
node scripts/capture-fixtures.mjs   # needs Node >= 22.18 (type stripping)
```

Then update the filenames in `index.ts`, the numbers in this README, and any test expectations that quote values.
