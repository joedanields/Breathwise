import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HouseholdProfileSchema } from '@shared/factsSnapshot';
import { afterEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '@/features/profile/scenarios';
import {
  createAppStores,
  DEFAULT_SETTINGS,
  LOCATION_KEY,
  PROFILE_KEY,
  SETTINGS_KEY,
} from '@/features/profile/stores';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const [s1] = SCENARIOS;
if (!s1) throw new Error('no scenarios');

describe('app stores', () => {
  it('starts with no profile, no location and default settings (remember location on)', () => {
    const stores = createAppStores();
    expect(stores.profile.get()).toBeNull();
    expect(stores.location.get()).toBeNull();
    expect(stores.settings.get()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.rememberLocation).toBe(true);
  });

  it('persists the profile across reloads', () => {
    createAppStores().profile.set(s1.profile);
    expect(createAppStores().profile.get()).toEqual(s1.profile);
  });

  it('resets a corrupt stored profile instead of crashing', () => {
    localStorage.setItem(PROFILE_KEY, '{"members":"nope"}');
    expect(createAppStores().profile.get()).toBeNull();
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it('rejects a stored member label over 30 characters', () => {
    const bad = {
      ...s1.profile,
      members: [{ id: 'x', label: 'y'.repeat(31), ageBand: 'adult_18_59', conditions: [] }],
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(bad));
    expect(createAppStores().profile.get()).toBeNull();
  });

  it('stores the location rounded to 2 dp', () => {
    createAppStores().setLocation({ ...s1.location, latitude: 28.613939, longitude: 77.209023 });
    expect(JSON.parse(localStorage.getItem(LOCATION_KEY) ?? '{}')).toMatchObject({
      latitude: 28.61,
      longitude: 77.21,
    });
  });

  it('keeps the location in memory only when "Remember location" is off, and drops the saved one', () => {
    const stores = createAppStores();
    stores.setLocation(s1.location);
    stores.updateSettings({ rememberLocation: false });
    expect(localStorage.getItem(LOCATION_KEY)).toBeNull();
    expect(stores.location.get()).toMatchObject({ label: 'New Delhi, Delhi' });
    expect(createAppStores().location.get()).toBeNull();
  });

  it('clearAll removes every Breathwise key and resets memory', () => {
    const stores = createAppStores();
    stores.profile.set(s1.profile);
    stores.setLocation(s1.location);
    stores.updateSettings({ theme: 'dark' });
    sessionStorage.setItem('breathwise.byok', 'x');
    localStorage.setItem('unrelated', '1');

    stores.clearAll();

    expect(stores.profile.get()).toBeNull();
    expect(stores.location.get()).toBeNull();
    expect(stores.settings.get()).toEqual(DEFAULT_SETTINGS);
    for (const key of [PROFILE_KEY, LOCATION_KEY, SETTINGS_KEY]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(sessionStorage.getItem('breathwise.byok')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('1');
  });
});

describe('SCENARIOS (TEST_SCENARIOS.md)', () => {
  it('has S1–S6 with valid profiles and Indian locations', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
    for (const scenario of SCENARIOS) {
      expect(HouseholdProfileSchema.safeParse(scenario.profile).success).toBe(true);
      expect(scenario.location.latitude).toBeGreaterThan(6);
      expect(scenario.location.longitude).toBeGreaterThan(68);
    }
  });

  it('matches the headings and sample questions in TEST_SCENARIOS.md', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/TEST_SCENARIOS.md'), 'utf8');
    const headings = [...doc.matchAll(/^## (S\d) — (.+)$/gm)].map((m) => [m[1], m[2]]);
    expect(headings).toEqual(SCENARIOS.map((s) => [s.id, s.title]));
    for (const scenario of SCENARIOS) {
      expect(doc).toContain(`**Ask:** "${scenario.ask}"`);
    }
  });

  it('uses the agreed car AC settings (S1 windows open, S6 AC closed)', () => {
    expect(SCENARIOS[0]?.profile.commute?.carAc).toBe('windows_open');
    expect(SCENARIOS[5]?.profile.commute?.carAc).toBe('ac_closed');
  });
});
