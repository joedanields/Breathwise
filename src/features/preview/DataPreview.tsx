// Phase 2 exit page (IMPLEMENTATION_PLAN.md): shows the parsed live values for a
// chosen location. Temporary: the Phase 5 dashboard replaces it.
import { useEffect, useId, useRef, useState } from 'react';
import type { AirQualityData } from '@/features/airquality/schemas';
import { type Fetched, useAirQuality } from '@/features/airquality/useAirQuality';
import { useNow } from '@/features/airquality/useNow';
import { LocationPicker } from '@/features/location/LocationPicker';
import type { SelectedLocation } from '@/features/location/types';
import type { WeatherData } from '@/features/weather/schemas';
import { useWeather } from '@/features/weather/useWeather';
import { formatMeasurement, ugm3ToMgm3 } from '@/lib/format';
import { describeFetchError, FetchFailure } from '@/lib/http';
import {
  formatFetchedAgo,
  formatReadingTime,
  isReadingStale,
  STALE_AFTER_MINUTES,
} from '@/lib/time';

export const AQ_SOURCE = 'Open-Meteo Air Quality API · CAMS global model';
export const WEATHER_SOURCE = 'Open-Meteo Forecast API';
export const MODEL_NOTE = 'Modelled estimate on a ~45 km grid, not a ground-station reading.';
export const GRID_NOTE = 'nearest model grid point ~45 km';

const UGM3 = 'µg/m³';

export function DataPreview() {
  const [location, setLocation] = useState<SelectedLocation | null>(null);

  return (
    <div className="mt-8 space-y-6">
      <LocationPicker onLocated={setLocation} />
      {location && <LiveData location={location} />}
    </div>
  );
}

function LiveData({ location }: { location: SelectedLocation }) {
  const headingId = useId();
  const airQuality = useAirQuality(location);
  const weather = useWeather(location);
  const now = useNow();

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-xl font-semibold">
          {location.label}
        </h2>
        <button
          type="button"
          onClick={() => {
            void airQuality.refetch();
            void weather.refetch();
          }}
          className="min-h-11 rounded-md border border-accent px-4 font-medium text-accent"
        >
          Refresh
        </button>
      </div>

      {airQuality.isPending && (
        <p role="status" className="text-muted">
          Loading live air quality…
        </p>
      )}
      {airQuality.isError && (
        <ErrorCard
          error={airQuality.error}
          onRetry={() => void airQuality.refetch()}
          hasOldData={airQuality.data !== undefined}
        />
      )}
      {airQuality.data && (
        <AirQualityCard result={airQuality.data} now={now} refreshFailed={airQuality.isError} />
      )}

      {weather.data && <WeatherCard result={weather.data} now={now} />}
      {weather.isError && (
        <p className="rounded-lg border border-border bg-surface p-4 text-muted">
          Weather is unavailable right now, so air quality is shown without weather context.
        </p>
      )}
    </section>
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
      <p className="font-medium">Live air quality couldn't be loaded.</p>
      <p className="mt-1 text-muted">
        {message}
        {hasOldData && ' The values below are from an earlier fetch.'}
      </p>
      <button
        ref={retryRef}
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-11 rounded-md bg-accent px-4 font-medium text-on-accent"
      >
        Retry
      </button>
    </div>
  );
}

interface AirQualityCardProps {
  result: Fetched<AirQualityData>;
  now: Date;
  /** The latest refresh failed, so these values are from an earlier fetch. */
  refreshFailed: boolean;
}

function AirQualityCard({ result, now, refreshFailed }: AirQualityCardProps) {
  const headingId = useId();
  const { current, timezone } = result.data;
  // Staleness comes from the reading time (hourly for India), not the fetch time.
  const readingStale = isReadingStale(current.time, now);
  const rows: [string, string, string][] = [
    [
      'PM2.5',
      'Fine particles, 2.5 micrometres or smaller',
      formatMeasurement(current.pm25Ugm3, UGM3),
    ],
    ['PM10', 'Particles, 10 micrometres or smaller', formatMeasurement(current.pm10Ugm3, UGM3)],
    ['NO₂', 'Nitrogen dioxide', formatMeasurement(current.no2Ugm3, UGM3)],
    ['SO₂', 'Sulphur dioxide', formatMeasurement(current.so2Ugm3, UGM3)],
    ['O₃', 'Ozone', formatMeasurement(current.o3Ugm3, UGM3)],
    ['CO', 'Carbon monoxide', formatMeasurement(ugm3ToMgm3(current.coUgm3), 'mg/m³', 1)],
    ['US AQI', 'United States Air Quality Index', formatMeasurement(current.usAqi, '')],
    ['Dust', 'Desert dust', formatMeasurement(current.dustUgm3, UGM3)],
    ['UV index', 'Ultraviolet index', formatMeasurement(current.uvIndex, '')],
  ];

  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <h3 id={headingId} className="text-lg font-semibold">
        Current air quality
      </h3>
      {(readingStale || refreshFailed) && (
        <p className="mt-2 rounded-md border-2 border-aqi-poor px-3 py-2 font-medium">
          Stale:{' '}
          {readingStale
            ? `this reading is more than ${String(STALE_AFTER_MINUTES)} minutes old.`
            : 'the latest refresh failed, so this is an earlier reading.'}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {rows.map(([abbr, title, value]) => (
          <div key={abbr}>
            <dt className="text-sm text-muted">
              <abbr title={title}>{abbr}</abbr>
            </dt>
            <dd className="text-lg font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <Provenance
        source={AQ_SOURCE}
        readingTime={current.time}
        timezone={timezone}
        fetchedAt={result.fetchedAt}
        now={now}
        modelled
      />
    </article>
  );
}

function WeatherCard({ result, now }: { result: Fetched<WeatherData>; now: Date }) {
  const headingId = useId();
  const { current, timezone } = result.data;
  const wind =
    current.windKmh === null
      ? formatMeasurement(null, '')
      : `${formatMeasurement(current.windKmh, 'km/h', 1)}${
          current.windDirDeg === null ? '' : ` from ${formatMeasurement(current.windDirDeg, '°')}`
        }`;
  const rows: [string, string][] = [
    ['Temperature', formatMeasurement(current.temperatureC, '°C', 1)],
    ['Humidity', formatMeasurement(current.humidityPct, '%')],
    ['Wind', wind],
    ['Precipitation', formatMeasurement(current.precipitationMm, 'mm', 1)],
  ];

  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <h3 id={headingId} className="text-lg font-semibold">
        Weather
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-lg font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <Provenance
        source={WEATHER_SOURCE}
        readingTime={current.time}
        timezone={timezone}
        fetchedAt={result.fetchedAt}
        now={now}
      />
    </article>
  );
}

interface ProvenanceProps {
  source: string;
  readingTime: string;
  timezone: string;
  fetchedAt: string;
  now: Date;
  modelled?: boolean;
}

/** CLAUDE.md rule 4: source, reading time, fetched-at time and the modelled-estimate note. */
function Provenance({ source, readingTime, timezone, fetchedAt, now, modelled }: ProvenanceProps) {
  return (
    <dl className="mt-4 grid gap-1 border-t border-border pt-3 text-sm text-muted sm:grid-cols-[auto_1fr] sm:gap-x-4">
      <dt className="font-medium text-text">Source</dt>
      <dd>{source}</dd>
      <dt className="font-medium text-text">Reading time</dt>
      <dd>
        <time dateTime={readingTime}>{formatReadingTime(readingTime, timezone)}</time>
      </dd>
      <dt className="font-medium text-text">Fetched</dt>
      <dd>
        <time dateTime={fetchedAt}>{formatFetchedAgo(fetchedAt, now)}</time>
      </dd>
      {modelled && (
        <>
          <dt className="font-medium text-text">Note</dt>
          <dd>{MODEL_NOTE}</dd>
          <dt className="font-medium text-text">Resolution</dt>
          <dd>{GRID_NOTE}</dd>
        </>
      )}
    </dl>
  );
}
