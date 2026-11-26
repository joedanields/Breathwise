import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationPicker } from '@/features/location/LocationPicker';
import { runAxe } from '../a11y/axe';
import { createRequestLog, reverseGeocodeHandler } from '../msw/handlers';
import { server } from '../msw/server';
import { fakeGeolocation, installGeolocation } from '../utils/geolocation';
import { renderWithQuery } from '../utils/render';

let uninstall: (() => void) | undefined;

afterEach(() => {
  uninstall?.();
  uninstall = undefined;
});

function withGeolocation(geolocation: Geolocation | undefined) {
  uninstall = installGeolocation(geolocation);
}

async function setupAndLocate() {
  const onLocated = vi.fn();
  const user = userEvent.setup();
  const view = renderWithQuery(<LocationPicker onLocated={onLocated} />);
  await user.click(screen.getByRole('button', { name: 'Use my location' }));
  const search = screen.getByRole('combobox', { name: 'Search for a town or city in India' });
  return { ...view, onLocated, search };
}

describe('LocationPicker — geolocation fails', () => {
  it('denied: explains, and moves focus to search', async () => {
    withGeolocation(fakeGeolocation({ errorCode: 1 }));

    const { search, onLocated } = await setupAndLocate();

    await waitFor(() => {
      expect(search).toHaveFocus();
    });
    expect(screen.getByText(/Location access is off for this site/)).toBeVisible();
    expect(search).toHaveAccessibleDescription(/Location access is off/);
    expect(onLocated).not.toHaveBeenCalled();
  });

  it('timed out: explains, and moves focus to search', async () => {
    withGeolocation(fakeGeolocation({ errorCode: 3 }));

    const { search } = await setupAndLocate();

    await waitFor(() => {
      expect(search).toHaveFocus();
    });
    expect(screen.getByText(/Finding your location took too long/)).toBeVisible();
  });

  it('unsupported browser: explains, and moves focus to search', async () => {
    withGeolocation(undefined);

    const { search } = await setupAndLocate();

    await waitFor(() => {
      expect(search).toHaveFocus();
    });
    expect(screen.getByText(/This browser can't share your location/)).toBeVisible();
  });

  it('shows progress while locating', async () => {
    withGeolocation(fakeGeolocation({ pending: true }));

    await setupAndLocate();

    expect(screen.getByText('Finding your location…')).toBeVisible();
  });
});

describe('LocationPicker — geolocation succeeds', () => {
  it('names an Indian location from BigDataCloud, sending only 2-decimal coordinates', async () => {
    withGeolocation(fakeGeolocation({ coords: { latitude: 18.52043, longitude: 73.856743 } }));
    const log = createRequestLog();
    server.use(reverseGeocodeHandler('reverseGeocodePune', log));

    const { onLocated } = await setupAndLocate();

    await waitFor(() => {
      expect(onLocated).toHaveBeenCalledOnce();
    });
    expect(onLocated.mock.calls[0]?.[0]).toEqual({
      latitude: 18.52043,
      longitude: 73.856743,
      label: 'Pune, Maharashtra',
      nameAvailable: true,
      source: 'gps',
    });
    expect(screen.getByText('Showing Pune, Maharashtra.')).toBeVisible();
    expect(log.urls[0]?.searchParams.get('latitude')).toBe('18.52');
    expect(log.urls[0]?.searchParams.get('longitude')).toBe('73.86');
  });

  it('outside India: shows the India-only message and moves focus to search', async () => {
    withGeolocation(fakeGeolocation({ coords: { latitude: 27.72, longitude: 85.32 } }));
    server.use(reverseGeocodeHandler('reverseGeocodeKathmandu'));

    const { onLocated, search } = await setupAndLocate();

    await waitFor(() => {
      expect(search).toHaveFocus();
    });
    expect(
      screen.getByText(
        'Breathwise covers India only. Your location appears to be in Nepal. Search for a town or city in India.',
      ),
    ).toBeVisible();
    expect(onLocated).not.toHaveBeenCalled();
  });

  it('reverse geocode fails inside the India box: continues with coordinates and keeps search visible', async () => {
    withGeolocation(fakeGeolocation({ coords: { latitude: 28.6139, longitude: 77.209 } }));
    server.use(reverseGeocodeHandler({ status: 503 }));

    const { onLocated, search } = await setupAndLocate();

    await waitFor(() => {
      expect(onLocated).toHaveBeenCalledOnce();
    });
    expect(onLocated.mock.calls[0]?.[0]).toMatchObject({
      label: 'Near 28.61, 77.21 (place name unavailable)',
      nameAvailable: false,
    });
    expect(
      screen.getByText(
        'Showing Near 28.61, 77.21 (place name unavailable). You can also search for your town or city.',
      ),
    ).toBeVisible();
    expect(search).toBeVisible();
  });

  it('reverse geocode fails outside the India box: India-only message', async () => {
    withGeolocation(fakeGeolocation({ coords: { latitude: 51.5072, longitude: -0.1276 } }));
    server.use(reverseGeocodeHandler({ status: 503 }));

    const { onLocated, search } = await setupAndLocate();

    await waitFor(() => {
      expect(search).toHaveFocus();
    });
    expect(screen.getByText(/Breathwise covers India only\. Search for a town/)).toBeVisible();
    expect(onLocated).not.toHaveBeenCalled();
  });

  it('has no axe violations after an error', async () => {
    withGeolocation(fakeGeolocation({ errorCode: 1 }));

    const { container, search } = await setupAndLocate();
    await waitFor(() => {
      expect(search).toHaveFocus();
    });

    expect(await runAxe(container)).toHaveNoViolations();
  });
});
