import { runAdvice } from '@shared/advice/advise';
import type { AdvicePlan, ChatAnswer } from '@shared/advice/planSchema';
import {
  type AdviceError,
  type AdviceRequest,
  AdviceResponseSchema,
} from '@shared/advice/requestSchema';
import { DEFAULT_MODEL } from '@shared/config';

export type TransportResult =
  | { ok: true; mode: 'plan'; data: AdvicePlan; model: string; via: 'proxy' | 'byok' }
  | { ok: true; mode: 'chat'; data: ChatAnswer; model: string; via: 'proxy' | 'byok' }
  | { ok: false; error: AdviceError };

export const ADVISE_ENDPOINT = '/api/advise';

/** Default transport: our Pages Function, which keeps the Gemini key server-side. */
async function viaProxy(request: AdviceRequest, signal?: AbortSignal): Promise<TransportResult> {
  let response: Response;
  try {
    response = await fetch(ADVISE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { ok: false, error: 'upstream' };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: response.status === 429 ? 'rate_limited' : 'upstream' };
  }
  const parsed = AdviceResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'invalid_output' };
  const value = parsed.data;
  if (!value.ok) return { ok: false, error: value.error };
  return value.mode === 'plan'
    ? { ok: true, mode: 'plan', data: value.data, model: value.model, via: 'proxy' }
    : { ok: true, mode: 'chat', data: value.data, model: value.model, via: 'proxy' };
}

/** BYOK: the browser calls Gemini directly with the same prompt and guard code. */
async function viaByok(
  request: AdviceRequest,
  apiKey: string,
  signal?: AbortSignal,
): Promise<TransportResult> {
  const outcome = await runAdvice(request, { apiKey, model: DEFAULT_MODEL, signal });
  if (!outcome.ok) return { ok: false, error: outcome.error };
  return outcome.mode === 'plan'
    ? { ok: true, mode: 'plan', data: outcome.data, model: outcome.model, via: 'byok' }
    : { ok: true, mode: 'chat', data: outcome.data, model: outcome.model, via: 'byok' };
}

/**
 * Sends an advice request and retries once on an upstream failure or timeout
 * (ARCHITECTURE.md §6). Never throws.
 */
export async function requestAdvice(
  request: AdviceRequest,
  { byokKey, signal }: { byokKey?: string | undefined; signal?: AbortSignal } = {},
): Promise<TransportResult> {
  const send = () => (byokKey ? viaByok(request, byokKey, signal) : viaProxy(request, signal));
  const first = await send();
  if (first.ok || first.error !== 'upstream' || signal?.aborted) return first;
  return send();
}
