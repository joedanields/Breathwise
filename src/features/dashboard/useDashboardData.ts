import type { HouseholdProfile } from '@shared/types';
import { useMemo } from 'react';
import { useAirQuality } from '@/features/airquality/useAirQuality';
import { useNow } from '@/features/airquality/useNow';
import type { SelectedLocation } from '@/features/location/types';
import { useWeather } from '@/features/weather/useWeather';
import { buildFactsSnapshot } from '@/lib/snapshot';

/**
 * Live data for the dashboard: AQ and weather queries (parallel) and the
 * FactsSnapshot built from them by pure rules. Weather is optional.
 */
export function useDashboardData(location: SelectedLocation, profile: HouseholdProfile) {
  const airQuality = useAirQuality(location);
  const weather = useWeather(location);
  const now = useNow();
  const minute = Math.floor(now.getTime() / 60_000);

  const snapshot = useMemo(() => {
    if (!airQuality.data) return null;
    return buildFactsSnapshot({
      airQuality: airQuality.data.data,
      fetchedAt: airQuality.data.fetchedAt,
      weather: weather.data?.data ?? null,
      location: {
        label: location.label,
        latitude: location.latitude,
        longitude: location.longitude,
        ...(location.state ? { state: location.state } : {}),
      },
      profile,
      now: new Date(minute * 60_000),
    });
  }, [airQuality.data, weather.data, location, profile, minute]);

  return { airQuality, weather, snapshot, now };
}
