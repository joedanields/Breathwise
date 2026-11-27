import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { geminiUrl } from '@shared/advice/gemini';
import { createHandler, type Env, isAllowedOrigin, onRequest } from '../../../functions/api/advise';
import { server } from '../../msw/server';
import { samplePlan, sampleSnapshot } from '../../utils/advice';

const KEY = 'server-secret-key-123';
const ORIGIN = 'https://breathwise.pages.dev';
const MODEL = 'gemini-test';

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
}

function env(overrides: Partial<Env> = {}): Env {
  return {
    GEMINI_API_KEY: KEY,
    GEMINI_MODEL: MODEL,
    ALLOWED_ORIGINS:
      'https://breathwise.pages.dev,https://*.breathwise.pages.dev,http://localhost:5173',
    RATE_LIMIT_KV: fakeKv(),
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://breathwise.pages.dev/api/advise', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.7',
      ...headers,
    },
    body: text,
  });
}

const planBody = () => ({ mode: 'plan', snapshot: sampleSnapshot() });

function geminiReturns(value: unknown) {
  server.use(
    http.post(geminiUrl(MODEL), () =>
      HttpResponse.json({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(value) }] }, finishReason: 'STOP' },
        ],
      }),
    ),
  );
}

async function call(request: Request, e: Env = env()) {
  const response = await onRequest({ request, env: e });
  return { response, text: await response.text() };
}

describe('origin rules', () => {
  it.each([
    ['https://breathwise.pages.dev', true],
    ['https://abc123.breathwise.pages.dev', true],
    ['http://localhost:5173', true],
    ['https://evil.com', false],
    ['https://breathwise.pages.dev.evil.com', false],
    ['https://evilbreathwise.pages.dev', false],
    ['http://abc123.breathwise.pages.dev', false],
    [null, false],
  ])('%s -> %s', (origin, allowed) => {
    expect(isAllowedOrigin(origin, env().ALLOWED_ORIGINS ?? '')).toBe(allowed);
  });
});

describe('/api/advise checks (SECURITY.md §3)', () => {
  it('405 for non-POST', async () => {
    const { response } = await call(
      new Request('https://breathwise.pages.dev/api/advise', { method: 'GET' }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });

  it('403 for a bad or missing origin', async () => {
    expect((await call(post(planBody(), { Origin: 'https://evil.com' }))).response.status).toBe(
      403,
    );
    const noOrigin = post(planBody());
    noOrigin.headers.delete('Origin');
    expect((await call(noOrigin)).response.status).toBe(403);
  });

  it('415 for the wrong content type', async () => {
    expect((await call(post(planBody(), { 'Content-Type': 'text/plain' }))).response.status).toBe(
      415,
    );
  });

  it('413 for an oversized body (declared or actual)', async () => {
    expect((await call(post(planBody(), { 'Content-Length': '999999' }))).response.status).toBe(
      413,
    );
    const big = { mode: 'plan', snapshot: sampleSnapshot(), pad: 'x'.repeat(30_000) };
    expect((await call(post(big))).response.status).toBe(413);
  });

  it('400 for an invalid body, without a schema dump', async () => {
    const { response, text } = await call(post({ mode: 'plan', snapshot: { nope: true } }));
    expect(response.status).toBe(400);
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'bad_request' });
    expect((await call(post('{not json'))).response.status).toBe(400);
  });

  it('429 after 10 requests a minute from one IP, with Retry-After', async () => {
    geminiReturns(samplePlan());
    const e = env();
    for (let i = 0; i < 10; i++)
      expect((await call(post(planBody()), e)).response.status).toBe(200);
    const { response, text } = await call(post(planBody()), e);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('429 once the daily cap is reached', async () => {
    const kv = fakeKv();
    const today = new Date().toISOString().slice(0, 10);
    kv.store.set(`rl:day:${today}`, '2000');
    expect((await call(post(planBody()), env({ RATE_LIMIT_KV: kv }))).response.status).toBe(429);
  });

  it('200 with a validated plan', async () => {
    geminiReturns(samplePlan());
    const { response, text } = await call(post(planBody()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(JSON.parse(text)).toMatchObject({ ok: true, mode: 'plan', model: MODEL, cached: false });
  });

  it('upstream on a Gemini 500, never echoing its body or the key', async () => {
    server.use(
      http.post(geminiUrl(MODEL), () =>
        HttpResponse.text(`internal ${KEY} trace`, { status: 500 }),
      ),
    );
    const { response, text } = await call(post(planBody()));
    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'upstream' });
    expect(text).not.toContain(KEY);
    expect(text).not.toContain('trace');
  });

  it('upstream when the server key is rejected (no auth detail leaks)', async () => {
    server.use(http.post(geminiUrl(MODEL), () => HttpResponse.json({}, { status: 403 })));
    expect(JSON.parse((await call(post(planBody()))).text)).toEqual({
      ok: false,
      error: 'upstream',
    });
  });

  it('upstream on a Gemini timeout', async () => {
    server.use(
      http.post(geminiUrl(MODEL), async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    const handler = createHandler({ timeoutMs: 20 });
    const response = await handler({ request: post(planBody()), env: env() });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: 'upstream' });
  });

  it('invalid_output when Gemini returns the wrong shape', async () => {
    geminiReturns({ headline: 'only this' });
    const { response, text } = await call(post(planBody()));
    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'invalid_output' });
  });

  it('upstream (not a crash) when GEMINI_API_KEY is missing', async () => {
    const { response, text } = await call(post(planBody()), env({ GEMINI_API_KEY: '' }));
    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'upstream' });
  });

  it('answers chat requests', async () => {
    geminiReturns({ answer: 'Yes, in W1.', relatedWindowRefs: ['W1'], outOfScope: false });
    const body = {
      mode: 'chat',
      snapshot: sampleSnapshot(),
      question: 'Can Aarav play at 5 pm?',
      history: [],
    };
    expect(JSON.parse((await call(post(body))).text)).toMatchObject({ ok: true, mode: 'chat' });
  });

  it('fits a realistic request under the body cap', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(planBody())).length;
    expect(bytes).toBeLessThan(16 * 1024);
  });
});
