// Cloudflare Pages Function: POST /api/advise (SECURITY.md §3, AI_DESIGN.md §2–3).
// Keeps GEMINI_API_KEY server-side; builds prompts itself — the client sends only
// structured, Zod-validated data, so this is not a general-purpose Gemini proxy.
// Relative imports only: Wrangler bundles this file without the app's path aliases.
import '../../shared/zodConfig';
import { runAdvice } from '../../shared/advice/advise';
import {
  type AdviceError,
  type AdviceRequest,
  AdviceRequestSchema,
} from '../../shared/advice/requestSchema';
import {
  DAILY_REQUEST_CAP,
  DEFAULT_MODEL,
  GEMINI_TIMEOUT_MS,
  MAX_BODY_BYTES,
  RATE_LIMIT_PER_MINUTE,
} from '../../shared/config';
import { log } from '../../shared/log';

interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_KV?: KvNamespace;
}

interface Context {
  request: Request;
  env: Env;
}

const STATUS: Readonly<Record<AdviceError, number>> = {
  bad_request: 400,
  forbidden: 403,
  method_not_allowed: 405,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  upstream: 502,
  invalid_output: 502,
  auth: 502,
};

/**
 * Pages applies `public/_headers` to static assets only, not to Function responses,
 * so the API sets its own hardening headers (SECURITY.md §4).
 */
export const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...API_SECURITY_HEADERS,
      ...headers,
    },
  });
}

function fail(error: AdviceError, headers: Record<string, string> = {}): Response {
  return json({ ok: false, error }, STATUS[error], headers);
}

/**
 * ALLOWED_ORIGINS is comma-separated. "https://*.example.dev" matches any
 * single host ending in ".example.dev" over https (preview deploys).
 */
export function isAllowedOrigin(origin: string | null, allowed: string): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  return allowed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => {
      const wildcard = /^https:\/\/\*\.(.+)$/.exec(entry);
      if (wildcard?.[1])
        return url.protocol === 'https:' && url.hostname.endsWith(`.${wildcard[1]}`);
      return entry === origin;
    });
}

/** Soft rate limit in KV (eventually consistent, acceptable per SECURITY.md §3). */
async function rateLimited(
  kv: KvNamespace | undefined,
  ip: string,
): Promise<'minute' | 'day' | null> {
  if (!kv) return null;
  const now = Date.now();
  const minuteKey = `rl:${ip}:${String(Math.floor(now / 60_000))}`;
  const dayKey = `rl:day:${new Date(now).toISOString().slice(0, 10)}`;
  const [minuteCount, dayCount] = await Promise.all([kv.get(minuteKey), kv.get(dayKey)]);
  if (Number(dayCount ?? 0) >= DAILY_REQUEST_CAP) return 'day';
  if (Number(minuteCount ?? 0) >= RATE_LIMIT_PER_MINUTE) return 'minute';
  await Promise.all([
    kv.put(minuteKey, String(Number(minuteCount ?? 0) + 1), { expirationTtl: 120 }),
    kv.put(dayKey, String(Number(dayCount ?? 0) + 1), { expirationTtl: 172_800 }),
  ]);
  return null;
}

/** A request check that either passes a value on or ends with an error response. */
type Checked<T> = { ok: true; value: T } | { ok: false; response: Response };

/** Steps 1–3: method, origin and content type. Returns the error response, or null to continue. */
function rejectRequest(request: Request, env: Env): Response | null {
  if (request.method !== 'POST') return fail('method_not_allowed', { Allow: 'POST' });
  if (!isAllowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS ?? '')) {
    return fail('forbidden');
  }
  const contentType = (request.headers.get('Content-Type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) return fail('unsupported_media_type');
  return null;
}

/** Steps 4–5: size limit (declared, then actual), JSON parsing and Zod validation. */
async function readAdviceRequest(request: Request): Promise<Checked<AdviceRequest>> {
  const tooLarge = { ok: false, response: fail('payload_too_large') } as const;
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return tooLarge;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return tooLarge;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, response: fail('bad_request') };
  }
  const parsed = AdviceRequestSchema.safeParse(body);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, response: fail('bad_request') };
}

/** The configured model; an empty GEMINI_MODEL counts as unset. */
function resolveModel(env: Env): string {
  const configured = (env.GEMINI_MODEL ?? '').trim();
  return configured === '' ? DEFAULT_MODEL : configured;
}

/** Steps 7–8: Gemini (with timeout), output validation and the grounding guard. */
async function adviseResponse(
  advice: AdviceRequest,
  deps: { apiKey: string; model: string; timeoutMs: number },
): Promise<Response> {
  const started = Date.now();
  const outcome = await runAdvice(advice, deps);
  if (outcome.ok) {
    const { mode, data, model } = outcome;
    return json({ ok: true, mode, data, model, cached: false });
  }
  // Failures only, for diagnosis: no profile, no prompt, no key.
  log.warn(
    JSON.stringify({
      route: 'advise',
      mode: advice.mode,
      model: deps.model,
      ms: Date.now() - started,
      result: outcome.reason,
    }),
  );
  // A rejected server key is an upstream problem for the user; never expose auth detail.
  return fail(outcome.error === 'auth' ? 'upstream' : outcome.error);
}

/** Builds the POST /api/advise handler; tests pass a short Gemini timeout. */
export function createHandler({ timeoutMs = GEMINI_TIMEOUT_MS }: { timeoutMs?: number } = {}) {
  return async function handle({ request, env }: Context): Promise<Response> {
    const rejected = rejectRequest(request, env);
    if (rejected) return rejected;
    const advice = await readAdviceRequest(request);
    if (!advice.ok) return advice.response;
    // 6. Rate limit
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const limit = await rateLimited(env.RATE_LIMIT_KV, ip);
    if (limit) return fail('rate_limited', { 'Retry-After': limit === 'minute' ? '60' : '3600' });
    if (!env.GEMINI_API_KEY) {
      log.error('advise: GEMINI_API_KEY is not configured');
      return fail('upstream');
    }
    const deps = { apiKey: env.GEMINI_API_KEY, model: resolveModel(env), timeoutMs };
    return adviseResponse(advice.value, deps);
  };
}

export const onRequest = createHandler();
