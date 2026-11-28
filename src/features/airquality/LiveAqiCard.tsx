import type { FactsSnapshot, Pollutant } from '@shared/types';
import { useId, useState } from 'react';
import { categoryForIndex, CATEGORY_LABELS } from '@/lib/aqi/categories';
import { formatMeasurement } from '@/lib/format';
import { CATEGORY_CLASSES } from './categoryClasses';
import { CategoryBadge, CategoryIcon } from './categoryStyles';
import { FreshnessBar } from './FreshnessBar';

const POLLUTANT_NAMES: Readonly<Record<Pollutant, [string, string]>> = {
  pm25: ['PM2.5', 'Fine particles, 2.5 micrometres or smaller'],
  pm10: ['PM10', 'Particles, 10 micrometres or smaller'],
  no2: ['NO₂', 'Nitrogen dioxide'],
  so2: ['SO₂', 'Sulphur dioxide'],
  o3: ['O₃', 'Ozone'],
  co: ['CO', 'Carbon monoxide'],
};

interface LiveAqiCardProps {
  snapshot: FactsSnapshot;
  fetchedAt: string;
  now: Date;
  refreshFailed: boolean;
}

/** UI_UX.md §4 LiveAqiCard + PollutantGrid + FreshnessBar. */
export function LiveAqiCard({ snapshot, fetchedAt, now, refreshFailed }: LiveAqiCardProps) {
  const headingId = useId();
  const { naqi, current, provenance, location } = snapshot;
  const summary = naqi
    ? `India AQI updated: ${String(naqi.value)}, ${CATEGORY_LABELS[naqi.category]}`
    : '';
  // Announce only changes after the first render (the value is visible on load).
  const [initialSummary] = useState(summary);

  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <h3 id={headingId} className="text-lg font-semibold">
        Current air quality
      </h3>
      <p role="status" aria-live="polite" className="sr-only">
        {summary === initialSummary ? '' : summary}
      </p>
      {naqi ? <IndexSummary naqi={naqi} /> : <IndexUnavailable />}
      <p className="mt-2 text-sm text-muted">
        US AQI (reference): {formatMeasurement(current.usAqi, '')}
        {snapshot.pm25Band && <> · PM2.5 level this hour: {CATEGORY_LABELS[snapshot.pm25Band]}</>}
      </p>
      <PollutantGrid current={current} subIndices={naqi?.subIndices} />
      <FreshnessBar
        readingTime={provenance.readingTime}
        timezone={location.timezone}
        fetchedAt={fetchedAt}
        now={now}
        refreshFailed={refreshFailed}
      />
    </article>
  );
}

type Naqi = NonNullable<FactsSnapshot['naqi']>;

/** The India AQI value, its category (icon + text, never colour alone) and main pollutant. */
function IndexSummary({ naqi }: { naqi: Naqi }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      <div
        className={`flex size-24 shrink-0 flex-col items-center justify-center rounded-xl ${CATEGORY_CLASSES[naqi.category]}`}
      >
        <CategoryIcon category={naqi.category} className="size-6" />
        <data value={naqi.value} className="text-3xl font-bold">
          {naqi.value}
        </data>
      </div>
      <div className="space-y-1">
        <p className="font-medium">India AQI (estimated)</p>
        <CategoryBadge category={naqi.category} />
        <p className="text-sm text-muted">Main pollutant: {POLLUTANT_NAMES[naqi.dominant][0]}</p>
      </div>
    </div>
  );
}

function IndexUnavailable() {
  return (
    <div className="mt-3 rounded-md border border-border p-3">
      <p className="font-medium">India AQI unavailable</p>
      <p className="text-sm text-muted">
        Not enough recent hours to estimate the 24-hour index. PM2.5 levels and the plan still use
        the hourly data.
      </p>
    </div>
  );
}

/** One tile per pollutant: the live value and, when available, its 24-hour sub-index. */
function PollutantGrid({
  current,
  subIndices,
}: {
  current: FactsSnapshot['current'];
  subIndices: Naqi['subIndices'] | undefined;
}) {
  const tiles: [Pollutant, string][] = [
    ['pm25', formatMeasurement(current.pm25Ugm3, 'µg/m³')],
    ['pm10', formatMeasurement(current.pm10Ugm3, 'µg/m³')],
    ['no2', formatMeasurement(current.no2Ugm3, 'µg/m³')],
    ['so2', formatMeasurement(current.so2Ugm3, 'µg/m³')],
    ['o3', formatMeasurement(current.o3Ugm3, 'µg/m³')],
    ['co', formatMeasurement(current.coMgm3, 'mg/m³', 1)],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map(([pollutant, value]) => {
        const [abbr, title] = POLLUTANT_NAMES[pollutant];
        const sub = subIndices?.[pollutant];
        return (
          <div key={pollutant} className="rounded-md border border-border p-2">
            <dt className="text-sm text-muted">
              <abbr title={title}>{abbr}</abbr>
            </dt>
            <dd className="text-lg font-semibold">{value}</dd>
            <dd className="text-xs text-muted">
              {sub === undefined
                ? 'No 24 h index'
                : `Index ${String(sub)} · ${CATEGORY_LABELS[categoryForIndex(sub)]}`}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
