// Thin Gemini REST client (ADR-007, AI_DESIGN.md §4). Header auth only — the key
// never goes in the URL. Shared by the Pages Function and BYOK.
import { z } from 'zod';
import { GEMINI_BASE_URL, GEMINI_TIMEOUT_MS, MAX_OUTPUT_TOKENS, TEMPERATURE } from '../config';

export type GeminiError =
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | { kind: 'network' }
  | { kind: 'auth'; status: number }
  | { kind: 'quota' }
  | { kind: 'http'; status: number }
  | { kind: 'blocked'; reason: string }
  | { kind: 'invalid_json' };

export type GeminiResult =
  | { ok: true; value: unknown; usage: { promptTokens?: number; outputTokens?: number } }
  | { ok: false; error: GeminiError };

export interface GeminiCall {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  responseJsonSchema: unknown;
  timeoutMs?: number;
  signal?: AbortSignal | undefined;
  fetchImpl?: typeof fetch;
}

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }))
              .optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
    })
    .optional(),
});

export function geminiUrl(model: string): string {
  return `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
}

/** Parses JSON, tolerating a ```json fence around it. */
function parseJsonText(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(trimmed) as unknown;
}

const TIMEOUT = Symbol('timeout');

export async function callGemini({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  responseJsonSchema,
  timeoutMs = GEMINI_TIMEOUT_MS,
  signal,
  fetchImpl = fetch,
}: GeminiCall): Promise<GeminiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(TIMEOUT);
  }, timeoutMs);
  const onAbort = () => {
    controller.abort();
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetchImpl(geminiUrl(model), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
          responseJsonSchema,
        },
      }),
    });

    if (!response.ok) {
      // The upstream body is never passed on (it can echo request details).
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: { kind: 'auth', status: response.status } };
      }
      if (
        response.status === 400 &&
        /API_KEY_INVALID|API key not valid/i.test(await response.text())
      ) {
        return { ok: false, error: { kind: 'auth', status: 400 } };
      }
      if (response.status === 429) return { ok: false, error: { kind: 'quota' } };
      return { ok: false, error: { kind: 'http', status: response.status } };
    }

    const parsed = GeminiResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { ok: false, error: { kind: 'invalid_json' } };
    const { candidates, promptFeedback, usageMetadata } = parsed.data;
    const candidate = candidates?.[0];
    if (!candidate) {
      return {
        ok: false,
        error: { kind: 'blocked', reason: promptFeedback?.blockReason ?? 'NO_CANDIDATES' },
      };
    }
    if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
      return { ok: false, error: { kind: 'blocked', reason: candidate.finishReason } };
    }
    const text = (candidate.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('');
    try {
      return {
        ok: true,
        value: parseJsonText(text),
        usage: {
          ...(usageMetadata?.promptTokenCount === undefined
            ? {}
            : { promptTokens: usageMetadata.promptTokenCount }),
          ...(usageMetadata?.candidatesTokenCount === undefined
            ? {}
            : { outputTokens: usageMetadata.candidatesTokenCount }),
        },
      };
    } catch {
      return { ok: false, error: { kind: 'invalid_json' } };
    }
  } catch {
    if (controller.signal.reason === TIMEOUT) return { ok: false, error: { kind: 'timeout' } };
    if (controller.signal.aborted) return { ok: false, error: { kind: 'aborted' } };
    return { ok: false, error: { kind: 'network' } };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
