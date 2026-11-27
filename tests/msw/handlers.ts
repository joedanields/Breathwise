import { type AnyHandler, http, HttpResponse, type JsonBodyType } from 'msw';
import { AIR_QUALITY_URL } from '@/features/airquality/request';
import { GEOCODING_SEARCH_URL, REVERSE_GEOCODE_URL } from '@/features/location/request';
import { FORECAST_URL } from '@/features/weather/request';
import { type FixtureName, loadFixture } from '../fixtures';

/**
 * Default handlers: none. Any request a test doesn't set up explicitly fails
 * (see tests/setup.ts), so tests can never silently reach a live API.
 * Tests add the handlers they need with `server.use(...)` and the factories below.
 */
export const handlers: AnyHandler[] = [];

type Reply = FixtureName | { status: number; body?: unknown };

function respond(reply: Reply) {
  if (typeof reply === 'string') return HttpResponse.json(loadFixture(reply));
  return HttpResponse.json(reply.body ?? { error: true, reason: 'test failure' }, {
    status: reply.status,
  });
}

/** Records every request URL so tests can assert on count and parameters. */
export function createRequestLog() {
  const urls: URL[] = [];
  return { urls, record: (request: Request) => urls.push(new URL(request.url)) };
}

type Log = ReturnType<typeof createRequestLog>;

export function airQualityHandler(reply: Reply, log?: Log) {
  return http.get(AIR_QUALITY_URL, ({ request }) => {
    log?.record(request);
    return respond(reply);
  });
}

export function weatherHandler(reply: Reply, log?: Log) {
  return http.get(FORECAST_URL, ({ request }) => {
    log?.record(request);
    return respond(reply);
  });
}

/** Answers place searches; `pick` chooses the reply from the `name` query parameter. */
export function placeSearchHandler(pick: (name: string) => Reply, log?: Log) {
  return http.get(GEOCODING_SEARCH_URL, ({ request }) => {
    log?.record(request);
    return respond(pick(new URL(request.url).searchParams.get('name') ?? ''));
  });
}

export function reverseGeocodeHandler(reply: Reply, log?: Log) {
  return http.get(REVERSE_GEOCODE_URL, ({ request }) => {
    log?.record(request);
    return respond(reply);
  });
}

/** Answers POST /api/advise (our Pages Function); never live Gemini in tests. */
export function adviseHandler(reply: { status?: number; body: unknown }, log?: Log) {
  return http.post('*/api/advise', ({ request }) => {
    log?.record(request);
    return HttpResponse.json(reply.body as JsonBodyType, { status: reply.status ?? 200 });
  });
}
