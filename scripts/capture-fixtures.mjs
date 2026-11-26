#!/usr/bin/env node
// Records real Open-Meteo responses into tests/fixtures/ (TESTING.md §2).
// Dev-only: run by hand with `node scripts/capture-fixtures.mjs` (Node >= 22.18
// strips the TypeScript types from the imported request builders).
//
// - Real responses keep the capture date (IST) in the filename and are never edited.
// - Derived fixtures (aq-derived-*.json) are built from the Delhi response captured
//   in the same run; tests/fixtures/README.md explains each one.
// - BigDataCloud is NEVER called from here: its free endpoint is for browsers only.
//   Its fixtures are pasted in by hand from a browser.

import { mkdir, writeFile } from 'node:fs/promises';
import { buildAirQualityUrl } from '../src/features/airquality/request.ts';
import { buildPlaceSearchUrl } from '../src/features/location/request.ts';
import { buildForecastUrl } from '../src/features/weather/request.ts';

const FIXTURES_DIR = new URL('../tests/fixtures/', import.meta.url);

// Test cities only; the app never hard-codes a location.
const CITIES = [
  { slug: 'delhi', latitude: 28.61, longitude: 77.21 },
  { slug: 'chennai', latitude: 13.08, longitude: 80.27 },
];

const SEARCHES = [
  { slug: 'lucknow', query: 'Lucknow' },
  { slug: 'pun', query: 'Pun' }, // prefix match: several results
  { slug: 'no-match', query: 'Qzxqzxq' },
];

// NAQI severe band starts above these 24-hour averages (AQI_AND_RULES.md, CPCB).
const SEVERE_PM25_24H = 250;
const SEVERE_PM10_24H = 430;
// Targets for the derived severe fixture: well inside the severe band.
const TARGET_PM25_24H = 300;
const TARGET_PM10_24H = 500;

const captureDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
  new Date(),
);

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'breathwise-fixture-capture' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function save(name, data) {
  const url = new URL(name, FIXTURES_DIR);
  await writeFile(url, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote tests/fixtures/${name}`);
}

/** Index of the last hourly slot at or before `current.time` (both local, no offset). */
function currentHourIndex(aq) {
  const index = aq.hourly.time.findLastIndex((time) => time <= aq.current.time);
  if (index < 23) throw new Error('Need at least 24 hours of history (past_days=1).');
  return index;
}

/** Mean of the 24 hourly values ending at `endIndex`, ignoring nulls. */
function trailing24hMean(values, endIndex) {
  const window = values.slice(endIndex - 23, endIndex + 1).filter((v) => v !== null);
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

const round1 = (value) => Math.round(value * 10) / 10;
const scale = (value, factor) => (value === null ? null : round1(value * factor));

function deriveSevere(aq) {
  const end = currentHourIndex(aq);
  const pm25Factor = TARGET_PM25_24H / trailing24hMean(aq.hourly.pm2_5, end);
  const pm10Factor = TARGET_PM10_24H / trailing24hMean(aq.hourly.pm10, end);
  const derived = structuredClone(aq);
  derived.hourly.pm2_5 = aq.hourly.pm2_5.map((v) => scale(v, pm25Factor));
  derived.hourly.pm10 = aq.hourly.pm10.map((v) => scale(v, pm10Factor));
  derived.current.pm2_5 = scale(aq.current.pm2_5, pm25Factor);
  derived.current.pm10 = scale(aq.current.pm10, pm10Factor);
  return { derived, pm25Factor, pm10Factor };
}

// Null gaps, relative to the current hour index `end` (24-hour window = end-23..end):
// - pm2_5: 10 nulls in the window (6 in a row + 4 scattered) -> 14 valid hours (< 16).
// - pm10: 4 nulls in the window -> 20 valid hours (>= 16).
// - pm2_5: 3 nulls in the forecast (end+5..end+7).
// - current.us_aqi and current.dust: null.
function deriveNullGaps(aq) {
  const end = currentHourIndex(aq);
  const derived = structuredClone(aq);
  const pm25Gaps = [-20, -19, -18, -17, -16, -15, -10, -7, -4, -1, 5, 6, 7].map((d) => end + d);
  const pm10Gaps = [-12, -8, -6, -2].map((d) => end + d);
  for (const i of pm25Gaps) derived.hourly.pm2_5[i] = null;
  for (const i of pm10Gaps) derived.hourly.pm10[i] = null;
  derived.current.us_aqi = null;
  derived.current.dust = null;
  return { derived, end, pm25Gaps, pm10Gaps };
}

async function main() {
  await mkdir(FIXTURES_DIR, { recursive: true });
  const captured = {};

  for (const city of CITIES) {
    const aq = await getJson(buildAirQualityUrl(city.latitude, city.longitude));
    const weather = await getJson(buildForecastUrl(city.latitude, city.longitude));
    await save(`aq-${city.slug}-${captureDate}.json`, aq);
    await save(`weather-${city.slug}-${captureDate}.json`, weather);
    captured[city.slug] = aq;
  }

  for (const search of SEARCHES) {
    await save(
      `geo-search-${search.slug}-${captureDate}.json`,
      await getJson(buildPlaceSearchUrl(search.query)),
    );
  }

  const delhi = captured.delhi;
  const end = currentHourIndex(delhi);
  const pm25Mean = trailing24hMean(delhi.hourly.pm2_5, end);
  const pm10Mean = trailing24hMean(delhi.hourly.pm10, end);
  console.log(
    `Delhi trailing 24 h mean at ${delhi.hourly.time[end]}: PM2.5 ${pm25Mean.toFixed(1)}, PM10 ${pm10Mean.toFixed(1)} µg/m³`,
  );

  if (pm25Mean > SEVERE_PM25_24H || pm10Mean > SEVERE_PM10_24H) {
    console.log('Delhi is already severe: no derived severe fixture needed.');
  } else {
    const { derived, pm25Factor, pm10Factor } = deriveSevere(delhi);
    await save('aq-derived-severe.json', derived);
    console.log(
      `aq-derived-severe.json: PM2.5 x${pm25Factor.toFixed(3)}, PM10 x${pm10Factor.toFixed(3)} (from aq-delhi-${captureDate}.json)`,
    );
  }

  const gaps = deriveNullGaps(delhi);
  await save('aq-derived-null-gaps.json', gaps.derived);
  console.log(
    `aq-derived-null-gaps.json: current index ${gaps.end}; pm2_5 null at ${gaps.pm25Gaps.join(',')}; pm10 null at ${gaps.pm10Gaps.join(',')}`,
  );
}

await main();
