import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  airQualityQueryKey,
  LIVE_DATA_QUERY_OPTIONS,
  useAirQuality,
} from '@/features/airquality/useAirQuality';
import { useNow } from '@/features/airquality/useNow';
import { useWeather, weatherQueryKey } from '@/features/weather/useWeather';
import { FetchFailure } from '@/lib/http';
import { airQualityHandler, createRequestLog, weatherHandler } from '../../../msw/handlers';
import { server } from '../../../msw/server';
import { createTestQueryClient } from '../../../utils/render';

const LUCKNOW = { latitude: 26.846694, longitude: 80.946166 };

function wrapper() {
  const client = createTestQueryClient();
  return {
    client,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('live data query options (ARCHITECTURE.md §5)', () => {
  it('stale after 15 min, kept 60 min, refetched every 15 min only while visible', () => {
    expect(LIVE_DATA_QUERY_OPTIONS).toEqual({
      staleTime: 900_000,
      gcTime: 3_600_000,
      refetchInterval: 900_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    });
  });

  it('keys on coordinates rounded to 2 dp', () => {
    expect(airQualityQueryKey(LUCKNOW)).toEqual(['air-quality', 26.85, 80.95]);
    expect(weatherQueryKey(LUCKNOW)).toEqual(['weather', 26.85, 80.95]);
  });
});

describe('useAirQuality', () => {
  it('does nothing without a location', () => {
    const log = createRequestLog();
    server.use(airQualityHandler('aqDelhi', log));
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useAirQuality(null), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(log.urls).toHaveLength(0);
  });

  it('returns parsed data with the client fetch time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T13:05:00Z'));
    server.use(airQualityHandler('aqChennai'));
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useAirQuality(LUCKNOW), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.fetchedAt).toBe('2026-11-26T13:05:00.000Z');
    expect(result.current.data?.data.current.pm25Ugm3).toBe(7.4);
  });

  it('exposes a typed FetchFailure on a schema mismatch', async () => {
    server.use(airQualityHandler({ status: 200, body: { hourly: 'nope' } }));
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useAirQuality(LUCKNOW), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(FetchFailure);
    expect((result.current.error as FetchFailure).detail.kind).toBe('parse');
  });
});

describe('useWeather', () => {
  it('returns parsed weather', async () => {
    server.use(weatherHandler('weatherChennai'));
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useWeather(LUCKNOW), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data?.data.current.temperatureC).toBe(27.1);
    });
  });

  it('does nothing without a location', () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useWeather(null), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useNow', () => {
  it('ticks on the interval and stops on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-26T13:00:00Z'));
    const { result, unmount } = renderHook(() => useNow(60_000));
    expect(result.current.toISOString()).toBe('2026-11-26T13:00:00.000Z');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe('2026-11-26T13:01:00.000Z');

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
