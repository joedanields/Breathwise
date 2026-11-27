import type { FactsSnapshot } from '@shared/types';
import { useId } from 'react';
import { compassPoint, formatMeasurement } from '@/lib/format';
import { weatherContext } from '@/lib/rules/weatherContext';

interface WeatherStripProps {
  weather: FactsSnapshot['weather'];
  /** Highest precipitation probability in the next 12 hours. */
  maxPrecipProbPct: number | null;
  failed: boolean;
}

/** Weather context (UI_UX.md §3.2) with a rules-based sentence, not AI. */
export function WeatherStrip({ weather, maxPrecipProbPct, failed }: WeatherStripProps) {
  const headingId = useId();
  if (!weather) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-muted">
        {failed
          ? 'Weather is unavailable right now, so air quality is shown without weather context.'
          : 'Loading weather…'}
      </p>
    );
  }
  const wind =
    weather.windKmh === null
      ? formatMeasurement(null, '')
      : `${formatMeasurement(weather.windKmh, 'km/h', 1)}${
          weather.windDirDeg === null ? '' : ` from ${compassPoint(weather.windDirDeg)}`
        }`;
  const sentences = weatherContext({
    windKmh: weather.windKmh,
    humidityPct: weather.humidityPct,
    maxPrecipProbPct,
    boundaryLayerHeightM: weather.boundaryLayerHeightM,
  });

  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <h3 id={headingId} className="text-lg font-semibold">
        Weather
      </h3>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <dt className="text-sm text-muted">Temperature</dt>
          <dd className="font-semibold">{formatMeasurement(weather.tempC, '°C', 1)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Humidity</dt>
          <dd className="font-semibold">{formatMeasurement(weather.humidityPct, '%')}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Wind</dt>
          <dd className="font-semibold">{wind}</dd>
        </div>
      </dl>
      {sentences.length > 0 && <p className="mt-2">{sentences.join(' ')}</p>}
      <p className="mt-2 text-sm text-muted">Open-Meteo Forecast API</p>
    </article>
  );
}
