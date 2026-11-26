import { z } from 'zod';
import { err, ok, type Result } from './result';

export const DEFAULT_TIMEOUT_MS = 10_000;

export type FetchError =
  | { kind: 'network'; message: string }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | { kind: 'http'; status: number; reason?: string }
  | { kind: 'parse'; message: string };

export interface FetchJsonOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
}

/** Open-Meteo's error body on HTTP 400 (DATA_SOURCES.md §1). */
const ApiErrorBodySchema = z.object({ error: z.literal(true), reason: z.string() });

/** Abort reason that marks our own timeout, as opposed to the caller cancelling. */
const TIMEOUT_REASON = Symbol('timeout');

/**
 * GETs JSON and validates it with `schema`. Never throws: every failure is a
 * typed `FetchError`. A timeout and a caller-provided signal can both abort.
 */
export async function fetchJson<S extends z.ZodType>(
  url: string,
  schema: S,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<Result<z.output<S>, FetchError>> {
  if (signal?.aborted) return err({ kind: 'aborted' });

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(TIMEOUT_REASON);
  }, timeoutMs);
  const onCallerAbort = () => {
    controller.abort();
  };
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const body = await readJson(response);

    if (!response.ok) {
      const apiError = ApiErrorBodySchema.safeParse(body);
      return err(
        apiError.success
          ? { kind: 'http', status: response.status, reason: apiError.data.reason }
          : { kind: 'http', status: response.status },
      );
    }

    const parsed = schema.safeParse(body);
    return parsed.success
      ? ok(parsed.data)
      : err({ kind: 'parse', message: z.prettifyError(parsed.error) });
  } catch (error) {
    if (controller.signal.reason === TIMEOUT_REASON) return err({ kind: 'timeout' });
    if (controller.signal.aborted) return err({ kind: 'aborted' });
    return err({
      kind: 'network',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** Reads a JSON body; a body that is not JSON becomes `undefined` (fails any schema). */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Error thrown into TanStack Query so `query.error.detail` keeps the typed failure. */
export class FetchFailure extends Error {
  readonly detail: FetchError;

  constructor(detail: FetchError) {
    super(`Request failed: ${detail.kind}`);
    this.name = 'FetchFailure';
    this.detail = detail;
  }
}

export function unwrapOrThrow<T>(result: Result<T, FetchError>): T {
  if (result.ok) return result.value;
  throw new FetchFailure(result.error);
}

/** A calm, user-facing sentence. Upstream `reason` text is for logs only, never shown. */
export function describeFetchError(error: FetchError): string {
  switch (error.kind) {
    case 'network':
      return 'Could not reach the data service. Check your connection and try again.';
    case 'timeout':
      return 'The data service took too long to respond. Please try again.';
    case 'aborted':
      return 'The request was cancelled.';
    case 'http':
      return 'The data service is unavailable right now. Please try again shortly.';
    case 'parse':
      return 'The data service sent an unexpected response. Please try again later.';
  }
}
