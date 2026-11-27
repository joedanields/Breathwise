import { HouseholdProfileSchema } from '@shared/factsSnapshot';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { SelectedLocation } from '@/features/location/types';
import { roundCoordinate } from '@/lib/coords';
import {
  clearAppStorage,
  createLocalStore,
  type LocalStore,
  STORAGE_PREFIX,
} from '@/lib/localStore';
import { getLocalStorage, getSessionStorage } from '@/lib/storage';

export const PROFILE_KEY = `${STORAGE_PREFIX}profile.v1`;
export const SETTINGS_KEY = `${STORAGE_PREFIX}settings.v1`;
export const LOCATION_KEY = `${STORAGE_PREFIX}location.v1`;

export const SettingsSchema = z.strictObject({
  theme: z.enum(['system', 'light', 'dark']),
  /** On by default; coordinates are stored rounded to 2 dp (~1 km). */
  rememberLocation: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: Settings = { theme: 'system', rememberLocation: true };

export const StoredLocationSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  label: z.string().min(1).max(160),
  state: z.string().min(1).max(80).optional(),
  nameAvailable: z.boolean(),
  source: z.enum(['search', 'gps']),
});

/** Coordinates are kept to 2 dp everywhere we store them (privacy, ~1 km). */
export function roundLocation(location: SelectedLocation): SelectedLocation {
  return {
    ...location,
    latitude: roundCoordinate(location.latitude),
    longitude: roundCoordinate(location.longitude),
  };
}

export function createAppStores(
  local: Storage | undefined = getLocalStorage(),
  session: Storage | undefined = getSessionStorage(),
) {
  const settings = createLocalStore({
    key: SETTINGS_KEY,
    schema: SettingsSchema,
    fallback: DEFAULT_SETTINGS,
    storage: local,
  });
  const profile = createLocalStore({
    key: PROFILE_KEY,
    schema: HouseholdProfileSchema,
    fallback: null,
    storage: local,
  });
  const location = createLocalStore({
    key: LOCATION_KEY,
    schema: StoredLocationSchema,
    fallback: null,
    storage: local,
    persist: () => settings.get().rememberLocation,
  });

  return {
    settings,
    profile,
    location,
    setLocation(next: SelectedLocation) {
      location.set(roundLocation(next));
    },
    updateSettings(next: Partial<Settings>) {
      settings.set({ ...settings.get(), ...next });
      // Re-save (or drop) the location to match "Remember location".
      location.set(location.get());
    },
    /** "Clear all my data": every Breathwise key in both storages, and in memory. */
    clearAll() {
      clearAppStorage([local, session]);
      profile.clear();
      location.clear();
      settings.clear();
    },
  };
}

export type AppStores = ReturnType<typeof createAppStores>;

export const StoresContext = createContext<AppStores | null>(null);

export function useAppStores(): AppStores {
  const stores = useContext(StoresContext);
  if (!stores) throw new Error('useAppStores must be used inside AppProviders');
  return stores;
}

function useStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useProfile() {
  return useStore(useAppStores().profile);
}

export function useSettings() {
  return useStore(useAppStores().settings);
}

export function useStoredLocation() {
  return useStore(useAppStores().location);
}
