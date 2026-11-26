# Data Sources — Breathwise

All sources below are free, keyless, and callable from the browser. **Before implementing each client, open the linked docs and confirm parameter names and response fields** — APIs evolve; update this file if anything differs.

## 1. Open-Meteo Air Quality API (primary, live)

- Docs: https://open-meteo.com/en/docs/air-quality-api
- Base: `https://air-quality-api.open-meteo.com/v1/air-quality`
- Model: CAMS (Copernicus Atmosphere Monitoring Service). For India the **global** domain applies: ~0.4° (~45 km) grid, 3-hourly, 5-day horizon, updated every 12 h. Open-Meteo interpolates to hourly values. For India the `current` block is **hourly** (`current.interval` = 3600, verified 2026-11-26), not 15-minutely: the 15-minute data exists only for the European domain.
- Units: all concentrations in **µg/m³**, including CO (convert to mg/m³ for NAQI). `current_units.uv_index` is an empty string.
- Not available for India: `ammonia` (Europe only) and lead. NAQI is therefore computed from the six pollutants we fetch (see `AQI_AND_RULES.md`).
- Limits: `forecast_days` 0–7 (default 5), `past_days` 0–92.
- Errors: HTTP 400 with `{ "error": true, "reason": "..." }` (e.g. `"Forecast days is invalid. Allowed range 0 to 7. Given 9."`). Parse this shape and surface a generic message.
- Licence/attribution: CC BY 4.0; credit Open-Meteo and CAMS (see §6).

### Request

```
GET /v1/air-quality
  ?latitude={lat}&longitude={lon}
  &current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,dust,uv_index
  &hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi
  &past_days=1
  &forecast_days=3
  &timezone=auto
  &domains=cams_global
```

`past_days=1` is required so we have ≥ 24 h of history for NAQI rolling averages.

### Response fields we rely on (validate with Zod)

```
latitude, longitude, timezone, utc_offset_seconds
current: { time: "YYYY-MM-DDTHH:mm", interval: number, pm10, pm2_5, carbon_monoxide, nitrogen_dioxide,
           sulphur_dioxide, ozone, us_aqi, dust, uv_index }
current_units: { ... }
hourly: { time: string[], pm10: (number|null)[], pm2_5: (number|null)[], ... }
```

Hourly arrays can contain `null` — treat as missing, never as 0. `current` values can also be `null`.

Verified against a live New Delhi request (2026-11-26):
- `latitude`/`longitude` in the response are the **model grid cell** (e.g. 28.6, 77.2), not the requested point. Never display them as the user's location.
- `hourly.time` has 24 × (`past_days` + `forecast_days`) entries starting at 00:00 local time on the first past day (96 entries for 1 + 3). Every variable array has the same length as `time`; validate that.
- Time strings carry **no offset** (`"2026-11-26T13:30"`). The offset comes from `utc_offset_seconds` (19800 for India). Convert to ISO with offset (`2026-11-26T13:30:00+05:30`) at the parsing boundary.
- `current.time` can fall on a half hour (13:30 IST = 08:00 UTC) even though the interval is 3600 s.
- `timezone_abbreviation` is `"GMT+5:30"`, not `"IST"`. Format display times with `Intl.DateTimeFormat('en-IN', { timeZone, timeZoneName: 'short' })`, which gives "1:30 pm IST".

### Provenance to display

- Source: "Open-Meteo Air Quality API · CAMS global model"
- Reading time: `current.time` rendered in the response `timezone` (e.g. "6:30 pm IST")
- Fetched: client timestamp → "fetched 3 min ago"
- Note: "Modelled estimate on a ~45 km grid, not a ground-station reading."

## 2. Open-Meteo Forecast API (weather context)

- Docs: https://open-meteo.com/en/docs
- Base: `https://api.open-meteo.com/v1/forecast`

```
GET /v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation
  &hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,boundary_layer_height
  &forecast_days=3
  &timezone=auto
```

Used for explanations only ("calm, cold air traps pollution near the ground"; "rain later may clear the air").

Verified against a live New Delhi request (2026-11-26):
- `current.interval` is 900 (15-minutely data). Default units: °C, %, km/h, °, mm.
- `precipitation_probability` is hourly-only (not valid in `current`).
- `boundary_layer_height` (metres) **is available for India** (New Delhi: 20–35 m at night, ~990 m mid-afternoon), so it is requested as a mixing-height signal. Low values mean pollution is trapped near the ground.
- Same response conventions as §1: grid-cell coordinates, offset-less times plus `utc_offset_seconds`, and `{ error, reason }` on 400. `forecast_days` 0–16.

## 3. Open-Meteo Geocoding API (search)

- Docs: https://open-meteo.com/en/docs/geocoding-api
- Base: `https://geocoding-api.open-meteo.com/v1/search`

```
GET /v1/search?name={query}&count=8&language=en&format=json&countryCode=IN
```

Fields: `id, name, latitude, longitude, admin1 (state), admin2 (district), country_code, timezone, population`.
Display as `name, admin2 ?, admin1`. Forward search only (no reverse).

Verified against live requests (2026-11-26):
- **No matches → the `results` key is omitted** (`{"generationtime_ms": …}`); treat as an empty list. The same happens for 0–1 character queries.
- 2 characters match exact names only (`"Lu"` → the village Lu, Nagaland); 3+ characters use prefix matching (`"Luckn"` → Lucknow). Matching ignores case and diacritics.
- Everything except `id, name, latitude, longitude, country_code` can be absent: `admin2`, `admin3`, `admin4`, `population` and `postcodes` are often missing (e.g. the "Lu" result has no `admin2` or `population`). Make them optional in the schema.
- `count` max 100. `format=json` is the default.
- Attribution: "Location data based on GeoNames" (see §6).

## 4. BigDataCloud reverse geocoding (GPS → place name)

- Docs: https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api
- Base: `https://api.bigdatacloud.net/data/reverse-geocode-client`

```
GET /data/reverse-geocode-client?latitude={lat}&longitude={lon}&localityLanguage=en
```

Fields: `city, locality, principalSubdivision, countryCode, countryName`.
- Use `city || locality` as the name, `principalSubdivision` as state.
- If `countryCode !== "IN"`, show the "India only" message.
- **Fair use:** client-side only; call only after the user taps "Use my location". Never call from the Pages Function. On failure, fall back to showing rounded coordinates.

## 5. Gemini API (interpretation only)

- Docs: https://ai.google.dev/gemini-api/docs
- Models: https://ai.google.dev/gemini-api/docs/models — set `GEMINI_MODEL` to the **latest stable Flash** model listed at build time (e.g. a `gemini-3.x-flash` id). Never hard-code the id outside `shared/config.ts` / env.
- Current choice: `GEMINI_MODEL = "gemini-3.8-flash"` (`wrangler.toml` `[vars]`, `.dev.vars.example`). **Cheaper fallback:** `gemini-3.5-flash-lite`. Switch to it by changing the var if cost or quota becomes a concern; no code change needed.
- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Auth header: `x-goog-api-key: <key>` (never in the URL query string).
- See `AI_DESIGN.md` for body, schema and guards.

## 6. Attribution (footer + "About data" sheet)

```
Air quality: Open-Meteo.com, using Copernicus Atmosphere Monitoring Service (CAMS) data.
Contains modified Copernicus Atmosphere Monitoring Service information.
Weather & geocoding: Open-Meteo.com (CC BY 4.0). Location data based on GeoNames. Reverse geocoding: BigDataCloud.
India AQI is calculated by Breathwise from modelled concentrations using CPCB breakpoints.
```

GeoNames credit added 2026-11-26: the Open-Meteo Geocoding docs require "Location data based on GeoNames" (geonames.org).

Link each name to its source page.

## 7. Rules for using data

1. Never cache AQ data longer than 60 min; never show cached data without its reading time.
2. Never fill missing values with defaults; propagate `null` and degrade.
3. Round only for display (PM to integer, CO to 1 decimal mg/m³). Keep raw values for computation.
4. Coordinates sent to Gemini are rounded to 2 decimals (~1 km) for privacy.
5. Tests use captured real responses in `tests/fixtures/` (record date in filename, e.g. `aq-delhi-2026-11-25.json`). Runtime code never imports them.
