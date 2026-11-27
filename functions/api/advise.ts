// Cloudflare Pages Function: POST /api/advise (SECURITY.md §3, AI_DESIGN.md §2–3).
// Keeps GEMINI_API_KEY server-side; builds prompts itself — the client sends only
// structured, Zod-validated data, so this is not a general-purpose Gemini proxy.
// Relative imports only: Wrangler bundles this file without the app's path aliases.
import '../../shared/zodConfig';
import { runAdvice } from '../../shared/advice/advise';
import { type AdviceError, AdviceRequestSchema } from '../../shared/advice/requestSchema';
import {
  DAILY_REQUEST_CAP,
  DEFAULT_MODEL,
  GEMINI_TIMEOUT_MS,
  MAX_BODY_BYTES,
  RATE_LIMIT_PER_MINUTE,
} from '../../shared/config';

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

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
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

export function createHandler({ timeoutMs = GEMINI_TIMEOUT_MS }: { timeoutMs?: number } = {}) {
  return async function handle({ request, env }: Context): Promise<Response> {
    // 1. Method
    if (request.method !== 'POST') return fail('method_not_allowed', { Allow: 'POST' });
    // 2. Origin
    if (!isAllowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS ?? ''))
      return fail('forbidden');
    // 3. Content type
    if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) {
      return fail('unsupported_media_type');
    }
    // 4. Size (declared, then actual)
    if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES)
      return fail('payload_too_large');
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail('payload_too_large');
    // 5. Validate
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return fail('bad_request');
    }
    const parsed = AdviceRequestSchema.safeParse(body);
    if (!parsed.success) return fail('bad_request');
    // 6. Rate limit
    const limit = await rateLimited(
      env.RATE_LIMIT_KV,
      request.headers.get('CF-Connecting-IP') ?? 'unknown',
    );
    if (limit) return fail('rate_limited', { 'Retry-After': limit === 'minute' ? '60' : '3600' });
    // 7–8. Gemini (timeout) + output validation + grounding guard
    if (!env.GEMINI_API_KEY) {
      console.error('advise: GEMINI_API_KEY is not configured');
      return fail('upstream');
    }
    // An empty GEMINI_MODEL counts as unset.
    const configured = (env.GEMINI_MODEL ?? '').trim();
    const model = configured === '' ? DEFAULT_MODEL : configured;
    const started = Date.now();
    const outcome = await runAdvice(parsed.data, { apiKey: env.GEMINI_API_KEY, model, timeoutMs });
    if (!outcome.ok) {
      // Failures only, for diagnosis: no profile, no prompt, no key.
      console.warn(
        JSON.stringify({
          route: 'advise',
          mode: parsed.data.mode,
          model,
          ms: Date.now() - started,
          result: outcome.reason,
        }),
      );
    }
    if (!outcome.ok) {
      // A rejected server key is an upstream problem for the user; never expose auth detail.
      return fail(outcome.error === 'auth' ? 'upstream' : outcome.error);
    }
    return json({
      ok: true,
      mode: outcome.mode,
      data: outcome.data,
      model: outcome.model,
      cached: false,
    });
  };
}

export const onRequest = createHandler();
