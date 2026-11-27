import { readFileSync } from 'node:fs';

/** Fixture files by role. See README.md for what each one shows and how derived ones were made. */
export const FIXTURES = {
  aqDelhi: 'aq-delhi-2026-11-26.json',
  aqChennai: 'aq-chennai-2026-11-26.json',
  aqDerivedSevere: 'aq-derived-severe.json',
  aqDerivedNullGaps: 'aq-derived-null-gaps.json',
  weatherDelhi: 'weather-delhi-2026-11-26.json',
  weatherChennai: 'weather-chennai-2026-11-26.json',
  geoSearchLucknow: 'geo-search-lucknow-2026-11-26.json',
  geoSearchPun: 'geo-search-pun-2026-11-26.json',
  geoSearchNoMatch: 'geo-search-no-match-2026-11-26.json',
  reverseGeocodePune: 'reverse-geocode-pune-2026-11-26.json',
  reverseGeocodeKathmandu: 'reverse-geocode-kathmandu-2026-11-26.json',
  /** Synthetic /api/advise response for E2E (not air data; see README). */
  advicePlanSynthetic: 'advice-plan-synthetic.json',
} as const;

export type FixtureName = keyof typeof FIXTURES;

/** A fresh, untyped copy of a fixture: tests mutate it freely and parse it like a real response. */
export function loadFixture(name: FixtureName): Record<string, unknown> {
  const url = new URL(FIXTURES[name], import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>;
}
