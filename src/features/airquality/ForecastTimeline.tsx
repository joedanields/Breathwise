import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CATEGORY_LABELS } from '@/lib/aqi/categories';
import type { TimelineHour } from '@/lib/rules/timeline';
import { CATEGORY_CLASSES } from './categoryClasses';

const LEGEND =
  'W1, W2: best for outdoor activity · V1, V2: best to air the house · X1, X2: worst, avoid';

function hourLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', timeZone }).format(new Date(iso));
}

function dayLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', timeZone }).format(
    new Date(iso),
  );
}

function describe(hour: TimelineHour, timeZone: string): string {
  const level = hour.band ? CATEGORY_LABELS[hour.band] : 'no data';
  const value = hour.pm25Ugm3 === null ? 'not available' : String(Math.round(hour.pm25Ugm3));
  const labels = hour.labels.length > 0 ? `, ${hour.labels.join(', ')}` : '';
  return `${dayLabel(hour.time, timeZone)} ${hourLabel(hour.time, timeZone)}, PM2.5 ${value}, ${level}${labels}`;
}

interface ForecastTimelineProps {
  hours: TimelineHour[];
  timeZone: string;
}

/**
 * 48-hour PM2.5 timeline (UI_UX.md §4): hour cells with text labels, W/V/X
 * window badges, and a "Table view" with an accessible <table>.
 */
export function ForecastTimeline({ hours, timeZone }: ForecastTimelineProps) {
  const headingId = useId();
  const [table, setTable] = useState(false);

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-lg font-semibold">
          Next 48 hours: PM2.5 level
        </h3>
        <Button
          variant="secondary"
          aria-pressed={table}
          onClick={() => {
            setTable(!table);
          }}
        >
          Table view
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {LEGEND}. Hourly PM2.5 in µg/m³, not the 24-hour India AQI.
      </p>

      {table ? (
        <div className="mt-3">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Hourly PM2.5 forecast for the next 48 hours</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">
                  Time
                </th>
                <th scope="col" className="py-2 pr-3">
                  PM2.5 (µg/m³)
                </th>
                <th scope="col" className="py-2 pr-3">
                  Level
                </th>
                <th scope="col" className="py-2">
                  Window
                </th>
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour.time} className="border-b border-border">
                  <th scope="row" className="py-1.5 pr-3 font-normal">
                    {dayLabel(hour.time, timeZone)} {hourLabel(hour.time, timeZone)}
                  </th>
                  <td className="py-1.5 pr-3">
                    {hour.pm25Ugm3 === null ? '—' : Math.round(hour.pm25Ugm3)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {hour.band ? CATEGORY_LABELS[hour.band] : 'No data'}
                  </td>
                  <td className="py-1.5">{hour.labels.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          role="region"
          aria-label="48-hour PM2.5 timeline, scrolls sideways"
          // A scrollable region must be keyboard-focusable (WCAG 2.1.1, axe scrollable-region-focusable).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="mt-3 overflow-x-auto pb-2"
        >
          <ol className="flex gap-1">
            {hours.map((hour) => (
              <li
                key={hour.time}
                aria-label={describe(hour, timeZone)}
                className="flex w-12 shrink-0 flex-col items-center gap-1 text-xs"
              >
                <span className="h-4 font-semibold text-accent">{hour.labels.join(' ')}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-full items-center justify-center rounded font-semibold ${
                    hour.band ? CATEGORY_CLASSES[hour.band] : 'border border-dashed border-muted'
                  }`}
                >
                  {hour.pm25Ugm3 === null ? '—' : Math.round(hour.pm25Ugm3)}
                </span>
                <span aria-hidden="true" className="text-muted">
                  {hourLabel(hour.time, timeZone)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
