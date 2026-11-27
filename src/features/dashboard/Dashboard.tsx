import type { HouseholdProfile } from '@shared/types';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ForecastTimeline } from '@/features/airquality/ForecastTimeline';
import { LiveAqiCard } from '@/features/airquality/LiveAqiCard';
import { LocationPicker } from '@/features/location/LocationPicker';
import type { SelectedLocation } from '@/features/location/types';
import { useAppStores } from '@/features/profile/stores';
import { WeatherStrip } from '@/features/weather/WeatherStrip';
import { describeFetchError, FetchFailure } from '@/lib/http';
import { forecastHours } from '@/lib/rules/timeline';
import { HouseholdToday } from './HouseholdToday';
import { useDashboardData } from './useDashboardData';

interface DashboardProps {
  location: SelectedLocation;
  profile: HouseholdProfile;
  /** The AI plan column (Phase 6); the rules-only summary shows without it. */
  plan?: ReactNode;
}

/** Live dashboard (UI_UX.md §3.2). Works fully without AI. */
export function Dashboard({ location, profile, plan }: DashboardProps) {
  const headingId = useId();
  const stores = useAppStores();
  const [changing, setChanging] = useState(false);
  const { airQuality, weather, snapshot, now } = useDashboardData(location, profile);

  const timeline =
    snapshot && airQuality.data
      ? forecastHours(
          {
            time: airQuality.data.data.hourly.time,
            pm25Ugm3: airQuality.data.data.hourly.pm25Ugm3,
          },
          airQuality.data.data.hourly.time.findLastIndex((t) => Date.parse(t) <= now.getTime()),
          [
            ...snapshot.windows.bestOutdoor,
            ...snapshot.windows.ventilate,
            ...snapshot.windows.worst,
          ],
        )
      : [];

  const maxPrecipProbPct = (() => {
    const data = weather.data?.data;
    if (!data) return null;
    const from = data.hourly.time.findIndex((t) => Date.parse(t) > now.getTime());
    const next = data.hourly.precipProbPct.slice(Math.max(0, from), Math.max(0, from) + 12);
    const present = next.filter((v): v is number => v !== null);
    return present.length > 0 ? Math.max(...present) : null;
  })();

  return (
    <div className="mt-8 space-y-6">
      <section
        aria-labelledby={headingId}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <h2 id={headingId} className="text-xl font-semibold">
          {location.label}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            aria-expanded={changing}
            onClick={() => {
              setChanging(!changing);
            }}
          >
            Change location
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void airQuality.refetch();
              void weather.refetch();
            }}
          >
            Refresh
          </Button>
        </div>
      </section>
      {(changing || !location.nameAvailable) && (
        <LocationPicker
          onLocated={(next) => {
            stores.setLocation(next);
            setChanging(false);
          }}
        />
      )}

      {airQuality.isPending && <LoadingCards />}
      {airQuality.isError && (
        <ErrorCard
          error={airQuality.error}
          hasOldData={airQuality.data !== undefined}
          onRetry={() => void airQuality.refetch()}
        />
      )}

      {snapshot && airQuality.data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-6">
            <LiveAqiCard
              snapshot={snapshot}
              fetchedAt={airQuality.data.fetchedAt}
              now={now}
              refreshFailed={airQuality.isError}
            />
            <WeatherStrip
              weather={snapshot.weather}
              maxPrecipProbPct={maxPrecipProbPct}
              failed={weather.isError}
            />
            <ForecastTimeline hours={timeline} timeZone={snapshot.location.timezone} />
          </div>
          <div className="min-w-0 space-y-6">
            {plan}
            <HouseholdToday snapshot={snapshot} />
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingCards() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <p role="status" className="sr-only">
        Loading live air quality…
      </p>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-64 animate-pulse rounded-lg bg-border motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function ErrorCard({
  error,
  onRetry,
  hasOldData,
}: {
  error: Error;
  onRetry: () => void;
  hasOldData: boolean;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    retryRef.current?.focus(); // UI_UX.md §4: the Retry button receives focus
  }, []);
  const message =
    error instanceof FetchFailure
      ? describeFetchError(error.detail)
      : 'Something went wrong while loading air quality.';
  return (
    <div role="alert" className="rounded-lg border border-aqi-very-poor bg-surface p-4">
      <p className="font-medium">Live air quality couldn&apos;t be loaded.</p>
      <p className="mt-1 text-muted">
        {message}
        {hasOldData && ' The values below are from an earlier fetch.'}
      </p>
      <Button ref={retryRef} className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
