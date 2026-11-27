import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { GRID_NOTE, MODEL_NOTE } from '@/features/airquality/FreshnessBar';
import { AIR_QUALITY_URL } from '@/features/airquality/request';
import { SCENARIOS } from '@/features/profile/scenarios';
import { createAppStores } from '@/features/profile/stores';
import { loadFixture } from '../fixtures';
import { runAxe } from '../a11y/axe';
import { adviseHandler, airQualityHandler, weatherHandler } from '../msw/handlers';
import { server } from '../msw/server';
import { at } from '../utils/at';
import { createTestQueryClient } from '../utils/render';

// Delhi fixture reading: 2026-11-26T18:30 IST (13:00 UTC).
const TEN_MIN_AFTER = new Date('2026-11-26T13:10:00Z');
const S1 = at(SCENARIOS, 0);

beforeEach(() => {
  server.use(adviseHandler({ status: 502, body: { ok: false, error: 'upstream' } }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TEN_MIN_AFTER);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const stores = createAppStores();
  stores.profile.set(S1.profile);
  stores.setLocation(S1.location);
  const user = userEvent.setup();
  const view = render(<App queryClient={createTestQueryClient()} stores={stores} />);
  return { ...view, user, stores };
}

const card = () => screen.findByRole('article', { name: 'Current air quality' });

describe('Dashboard', () => {
  beforeEach(() => {
    server.use(
      airQualityHandler('aqDelhi'),
      weatherHandler('weatherDelhi'),
      adviseHandler({ status: 502, body: { ok: false, error: 'upstream' } }),
    );
  });

  it('shows India AQI with category text, icon, dominant pollutant and US AQI', async () => {
    setup();
    const live = within(await card());
    expect(live.getByText('300', { selector: 'data' })).toHaveAttribute('value', '300');
    expect(live.getByText('India AQI (estimated)')).toBeVisible();
    expect(live.getAllByText('Poor').length).toBeGreaterThan(0);
    expect(live.getByText('Main pollutant: PM2.5')).toBeVisible();
    expect(live.getByText(/US AQI \(reference\): 197/)).toBeVisible();
    expect((await card()).querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows provenance: reading time, fetched time, source and the model notes', async () => {
    setup();
    const live = within(await card());
    expect(live.getByText('26 Nov, 6:30 pm IST')).toHaveAttribute(
      'datetime',
      '2026-11-26T18:30:00+05:30',
    );
    expect(live.getByText('fetched just now')).toBeVisible();
    expect(live.getByText(/Open-Meteo Air Quality API · CAMS global model/)).toBeVisible();
    expect(live.getByText(new RegExp(MODEL_NOTE.replace(/[.~]/g, '\\$&')))).toBeVisible();
    expect(live.getByText(new RegExp(GRID_NOTE))).toBeVisible();
    expect(live.queryByText(/Stale/)).toBeNull();
  });

  it('marks data stale by reading time (> 90 min)', async () => {
    vi.setSystemTime(new Date('2026-11-26T14:31:00Z'));
    setup();
    expect(
      within(await card()).getByText(/Stale: this reading is more than 90 minutes old\./),
    ).toBeVisible();
  });

  it('shows the pollutant grid with 24 h sub-index labels', async () => {
    setup();
    const live = within(await card());
    expect(live.getByText('103 µg/m³')).toBeVisible();
    expect(live.getByText('2.5 mg/m³')).toBeVisible();
    expect(live.getByText('Index 300 · Poor')).toBeVisible();
  });

  it('says "India AQI unavailable" when there are not enough hours', async () => {
    const body = loadFixture('aqDerivedNullGaps');
    const hourly = body.hourly as Record<string, unknown[]>;
    hourly.pm10 = hourly.pm10?.map(() => null) ?? [];
    server.use(http.get(AIR_QUALITY_URL, () => HttpResponse.json(body)));
    setup();
    const live = within(await card());
    expect(live.getByText('India AQI unavailable')).toBeVisible();
    expect(live.getByText(/PM2.5 level this hour: Poor/)).toBeVisible();
  });

  it('announces a changed India AQI after a refresh (live region)', async () => {
    const { user } = setup();
    const live = await card();
    const region = within(live).getByRole('status');
    expect(region).toBeEmptyDOMElement();
    server.use(airQualityHandler('aqDerivedSevere'));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => {
      expect(region).toHaveTextContent(/^India AQI updated: \d+, Severe$/);
    });
  });

  it('shows the weather with a compass direction and rules-based context', async () => {
    setup();
    const weather = within(await screen.findByRole('article', { name: 'Weather' }));
    expect(weather.getByText('19.1 °C')).toBeVisible();
    expect(weather.getByText('5.1 km/h from W')).toBeVisible();
    expect(weather.getByText('Open-Meteo Forecast API')).toBeVisible();
  });

  it('shows a 48-hour timeline with window badges, and a table view', async () => {
    const { user } = setup();
    const timeline = await screen.findByRole('region', { name: /48-hour PM2.5 timeline/ });
    const cells = within(timeline).getAllByRole('listitem');
    expect(cells).toHaveLength(48);
    expect(cells.some((c) => (c.getAttribute('aria-label') ?? '').includes('W1'))).toBe(true);
    expect(cells[0]?.getAttribute('aria-label')).toMatch(
      /PM2\.5 \d+, (Good|Satisfactory|Moderate|Poor|Very Poor|Severe)/,
    );

    const toggle = screen.getByRole('button', { name: 'Table view' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const table = screen.getByRole('table', { name: /Hourly PM2.5 forecast/ });
    expect(within(table).getAllByRole('row')).toHaveLength(49);
  });

  it("summarises each member's risk and the best windows without AI", async () => {
    setup();
    const today = within(await screen.findByRole('region', { name: 'Today for your household' }));
    expect(today.getByText('Very high risk')).toBeVisible();
    expect(today.getByText('High risk')).toBeVisible();
    expect(today.getByText('W1')).toBeVisible();
    expect(today.getByText(/not medical advice/)).toBeVisible();
  });

  it('opens About data from the freshness bar and returns focus', async () => {
    const { user } = setup();
    const trigger = within(await card()).getByRole('button', { name: 'About data' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'About & privacy' });
    expect(within(dialog).getByText(/How India AQI is estimated/)).toBeVisible();
    expect(await runAxe(dialog)).toHaveNoViolations();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('can change the location', async () => {
    const { user, stores } = setup();
    await card();
    const change = screen.getByRole('button', { name: 'Change location' });
    await user.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('combobox', { name: 'Search for a town or city in India' }),
    ).toBeVisible();
    expect(stores.location.get()?.label).toBe('New Delhi, Delhi');
  });

  it('has no axe violations with data loaded', async () => {
    const { container } = setup();
    await card();
    await screen.findByRole('article', { name: 'Weather' });
    expect(await runAxe(container)).toHaveNoViolations();
  });
});

describe('Dashboard failures', () => {
  it('shows an error card whose Retry takes focus and recovers', async () => {
    server.use(airQualityHandler({ status: 502 }), weatherHandler('weatherDelhi'));
    const { user } = setup();
    const alert = await screen.findByRole('alert');
    const retry = within(alert).getByRole('button', { name: 'Retry' });
    expect(retry).toHaveFocus();
    server.use(airQualityHandler('aqDelhi'));
    await user.click(retry);
    expect(await card()).toBeVisible();
  });

  it('marks older data stale when a refresh fails', async () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));
    const { user } = setup();
    await card();
    server.use(airQualityHandler({ status: 500 }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('earlier fetch');
    expect(within(await card()).getByText(/latest refresh failed/)).toBeVisible();
  });

  it('continues without weather', async () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler({ status: 500 }));
    setup();
    expect(
      await screen.findByText(
        'Weather is unavailable right now, so air quality is shown without weather context.',
      ),
    ).toBeVisible();
    expect(await card()).toBeVisible();
  });

  it('shows a loading status before data arrives', () => {
    server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));
    setup();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Loading live air quality…');
  });
});
