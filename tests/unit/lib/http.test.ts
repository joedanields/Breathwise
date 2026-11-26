import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeFetchError, fetchJson, FetchFailure, unwrapOrThrow } from '@/lib/http';
import { err, ok } from '@/lib/result';
import { server } from '../../msw/server';

const URL_UNDER_TEST = 'https://example.test/data';
const Schema = z.object({ value: z.number() });

describe('fetchJson', () => {
  it('returns the parsed body on success', async () => {
    server.use(http.get(URL_UNDER_TEST, () => HttpResponse.json({ value: 42, extra: 'ignored' })));

    await expect(fetchJson(URL_UNDER_TEST, Schema)).resolves.toEqual(ok({ value: 42 }));
  });

  it('returns a parse error when the body does not match the schema', async () => {
    server.use(http.get(URL_UNDER_TEST, () => HttpResponse.json({ value: 'forty-two' })));

    const result = await fetchJson(URL_UNDER_TEST, Schema);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('parse');
  });

  it('returns a parse error when the body is not JSON', async () => {
    server.use(http.get(URL_UNDER_TEST, () => HttpResponse.text('<html>')));

    const result = await fetchJson(URL_UNDER_TEST, Schema);

    expect(!result.ok && result.error.kind).toBe('parse');
  });

  it('keeps the Open-Meteo { error, reason } message on HTTP 400', async () => {
    server.use(
      http.get(URL_UNDER_TEST, () =>
        HttpResponse.json(
          { error: true, reason: 'Forecast days is invalid. Allowed range 0 to 7. Given 9.' },
          { status: 400 },
        ),
      ),
    );

    await expect(fetchJson(URL_UNDER_TEST, Schema)).resolves.toEqual(
      err({
        kind: 'http',
        status: 400,
        reason: 'Forecast days is invalid. Allowed range 0 to 7. Given 9.',
      }),
    );
  });

  it('returns an http error without a reason for other error bodies', async () => {
    server.use(http.get(URL_UNDER_TEST, () => HttpResponse.text('Bad gateway', { status: 502 })));

    await expect(fetchJson(URL_UNDER_TEST, Schema)).resolves.toEqual(
      err({ kind: 'http', status: 502 }),
    );
  });

  it('returns a network error when the request fails', async () => {
    server.use(http.get(URL_UNDER_TEST, () => HttpResponse.error()));

    const result = await fetchJson(URL_UNDER_TEST, Schema);

    expect(!result.ok && result.error.kind).toBe('network');
  });

  it('returns a timeout error when the server is too slow', async () => {
    server.use(
      http.get(URL_UNDER_TEST, async () => {
        await delay('infinite');
        return HttpResponse.json({ value: 1 });
      }),
    );

    await expect(fetchJson(URL_UNDER_TEST, Schema, { timeoutMs: 20 })).resolves.toEqual(
      err({ kind: 'timeout' }),
    );
  });

  it('returns an aborted error when the caller cancels', async () => {
    server.use(
      http.get(URL_UNDER_TEST, async () => {
        await delay('infinite');
        return HttpResponse.json({ value: 1 });
      }),
    );
    const controller = new AbortController();

    const pending = fetchJson(URL_UNDER_TEST, Schema, { signal: controller.signal });
    controller.abort();

    await expect(pending).resolves.toEqual(err({ kind: 'aborted' }));
  });

  it('returns aborted straight away for an already-cancelled signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(fetchJson(URL_UNDER_TEST, Schema, { signal: controller.signal })).resolves.toEqual(
      err({ kind: 'aborted' }),
    );
  });
});

describe('unwrapOrThrow', () => {
  it('returns the value of an ok result', () => {
    expect(unwrapOrThrow(ok(3))).toBe(3);
  });

  it('throws a FetchFailure carrying the error', () => {
    const failure = { kind: 'http', status: 500 } as const;
    expect(() => unwrapOrThrow(err(failure))).toThrow(FetchFailure);
    try {
      unwrapOrThrow(err(failure));
    } catch (error) {
      expect(error instanceof FetchFailure && error.detail).toEqual(failure);
    }
  });
});

describe('describeFetchError', () => {
  it.each([
    [{ kind: 'network', message: 'x' }, /connection/i],
    [{ kind: 'timeout' }, /too long/i],
    [{ kind: 'aborted' }, /cancelled/i],
    [{ kind: 'http', status: 503 }, /unavailable/i],
    [{ kind: 'parse', message: 'x' }, /unexpected/i],
  ] as const)('gives a friendly message for %o', (error, pattern) => {
    expect(describeFetchError(error)).toMatch(pattern);
  });

  it('never exposes the upstream reason text', () => {
    expect(
      describeFetchError({ kind: 'http', status: 400, reason: 'internal detail' }),
    ).not.toMatch(/internal detail/);
  });
});
