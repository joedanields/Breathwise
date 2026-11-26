import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataPreview, GRID_NOTE, MODEL_NOTE } from '@/features/preview/DataPreview';
import { runAxe } from '../a11y/axe';
import {
  airQualityHandler,
  createRequestLog,
  placeSearchHandler,
  weatherHandler,
} from '../msw/handlers';
import { server } from '../msw/server';
import { renderWithQuery } from '../utils/render';

// The Delhi fixture's reading time is 2026-11-26T18:30 IST (13:00 UTC).
const TEN_MIN_AFTER_READING = new Date('2026-11-26T13:10:00Z');
const NINETY_ONE_MIN_AFTER_READING = new Date('2026-11-26T14:31:00Z');

beforeEach(() => {
  // Fake only Date: real timers keep the debounce and MSW working.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TEN_MIN_AFTER_READING);
  server.use(placeSearchHandler(() => 'geoSearchLucknow'));
});

afterEach(() => {
  vi.useRealTimers();
});

async function chooseLucknow() {
  const user = userEvent.setup();
  const view = renderWithQuery(<DataPreview />);
  await user.type(screen.getByRole('combobox'), 'Luck');
  await user.click(await screen.findByRole('option', { name: 'Lucknow, Uttar Pradesh' }));
  return { ...view, user };
}

function airQualityCard() {
  return screen.getByRole('article', { name: 'Current air quality' });
}

describe('DataPreview (Phase 2 exit page)', () => {
  it('shows parsed current values with full provenance for a searched city', async () => {
    const aqLog = createRequestLog();
    server.use(airQualityHandler('aqDelhi', aqLog), weatherHandler('weatherDelhi'));

    await chooseLucknow();

    expect(
      await screen.findByRole('heading', { name: 'Lucknow, Uttar Pradesh', level: 2 }),
    ).toBeVisible();
    const card = within(await screen.findByRole('article', { name: 'Current air quality' }));
    expect(card.getByText('103 µg/m³')).toBeVisible(); // PM2.5 103.4, rounded for display
    expect(card.getByText('2.5 mg/m³')).toBeVisible(); // CO 2471 µg/m³ -> mg/m³, 1 dp
    expect(card.getByText('197')).toBeVisible(); // US AQI
    expect(card.getByText('Open-Meteo Air Quality API · CAMS global model')).toBeVisible();
    expect(card.getByText('26 Nov, 6:30 pm IST')).toHaveAttribute(
      'datetime',
      '2026-11-26T18:30:00+05:30',
    );
    expect(card.getByText('fetched just now')).toBeVisible();
    expect(card.getByText(MODEL_NOTE)).toBeVisible();
    expect(card.getByText(GRID_NOTE)).toBeVisible();
    expect(GRID_NOTE).toBe('nearest model grid point ~45 km');
    expect(card.queryByText(/Stale/)).toBeNull();

    // The request uses the selected place, rounded to 2 dp.
    expect(aqLog.urls[0]?.searchParams.get('latitude')).toBe('26.84');
  });

  it('never shows the model grid cell as the location', async () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));

    await chooseLucknow();
    await screen.findByRole('article', { name: 'Current air quality' });

    // The Delhi fixture's grid cell is 28.599998, 77.20001.
    expect(screen.queryByText(/28\.6|77\.2/)).toBeNull();
  });

  it('shows weather with its own provenance', async () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));

    await chooseLucknow();

    const weather = within(await screen.findByRole('article', { name: 'Weather' }));
    expect(weather.getByText('19.1 °C')).toBeVisible();
    expect(weather.getByText('5.1 km/h from 252°')).toBeVisible();
    expect(weather.getByText('Open-Meteo Forecast API')).toBeVisible();
    expect(weather.getByText('26 Nov, 6:45 pm IST')).toBeVisible();
  });

  it('marks data stale from the reading time (> 90 min), even right after a fetch', async () => {
    vi.setSystemTime(NINETY_ONE_MIN_AFTER_READING);
    server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));

    await chooseLucknow();

    const card = within(await screen.findByRole('article', { name: 'Current air quality' }));
    expect(card.getByText('fetched just now')).toBeVisible();
    expect(card.getByText(/Stale: this reading is more than 90 minutes old\./)).toBeVisible();
  });

  it('shows missing values as "Not available", never 0', async () => {
    server.use(airQualityHandler('aqDerivedNullGaps'), weatherHandler('weatherDelhi'));

    await chooseLucknow();

    const card = within(await screen.findByRole('article', { name: 'Current air quality' }));
    const usAqi = card.getByText('US AQI').closest('div');
    const dust = card.getByText('Dust').closest('div');
    expect(usAqi).toHaveTextContent('US AQINot available');
    expect(dust).toHaveTextContent('DustNot available');
  });

  it('shows an error card whose Retry button takes focus and recovers', async () => {
    server.use(airQualityHandler({ status: 502 }), weatherHandler('weatherDelhi'));
    const { user } = await chooseLucknow();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Live air quality couldn't be loaded.");
    const retry = within(alert).getByRole('button', { name: 'Retry' });
    expect(retry).toHaveFocus();

    server.use(airQualityHandler('aqDelhi'));
    await user.click(retry);

    expect(await screen.findByRole('article', { name: 'Current air quality' })).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('marks earlier data stale when a refresh fails', async () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));
    const { user } = await chooseLucknow();
    await screen.findByRole('article', { name: 'Current air quality' });

    server.use(airQualityHandler({ status: 500 }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The values below are from an earlier fetch.',
    );
    expect(
      within(airQualityCard()).getByText(
        /the latest refresh failed, so this is an earlier reading/,
      ),
    ).toBeVisible();
  });

  it('continues without weather when the forecast fails', async () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler({ status: 500 }));

    await chooseLucknow();

    expect(
      await screen.findByText(
        'Weather is unavailable right now, so air quality is shown without weather context.',
      ),
    ).toBeVisible();
    expect(airQualityCard()).toBeVisible();
  });

  it('has no axe violations with data loaded', async () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));
    const { container } = await chooseLucknow();
    await screen.findByRole('article', { name: 'Weather' });

    expect(await runAxe(container)).toHaveNoViolations();
  });
});
