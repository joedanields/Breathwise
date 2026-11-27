// The advice engine shared by the Pages Function (proxy) and BYOK: prompt →
// Gemini → Zod → grounding guard → one retry → result (AI_DESIGN.md §2–7).
import type { z } from 'zod';
import { type GeminiError, callGemini } from './gemini';
import { allowedNumbers, chatTexts, planTexts, ungroundedNumbers } from './groundingGuard';
import {
  AdvicePlanSchema,
  type AdvicePlan,
  type ChatAnswer,
  ChatAnswerSchema,
  toGeminiSchema,
} from './planSchema';
import {
  buildChatUserPrompt,
  buildPlanUserPrompt,
  CHAT_SYSTEM_PROMPT,
  groundingRetryNote,
  PLAN_SYSTEM_PROMPT,
} from './prompt';
import type { AdviceError, AdviceRequest } from './requestSchema';

export type AdviceOutcome =
  | { ok: true; mode: 'plan'; data: AdvicePlan; model: string; attempts: number }
  | { ok: true; mode: 'chat'; data: ChatAnswer; model: string; attempts: number }
  | { ok: false; error: AdviceError; reason: string };

export interface AdviceDeps {
  apiKey: string;
  model: string;
  signal?: AbortSignal | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const PLAN_JSON_SCHEMA = toGeminiSchema(AdvicePlanSchema);
const CHAT_JSON_SCHEMA = toGeminiSchema(ChatAnswerSchema);
const MAX_ATTEMPTS = 2;

function mapGeminiError(error: GeminiError): { error: AdviceError; reason: string } {
  switch (error.kind) {
    case 'auth':
      return { error: 'auth', reason: `gemini_auth_${String(error.status)}` };
    case 'quota':
      return { error: 'rate_limited', reason: 'gemini_quota' };
    case 'blocked':
      return { error: 'invalid_output', reason: `blocked_${error.reason}` };
    case 'invalid_json':
      return { error: 'invalid_output', reason: 'invalid_json' };
    case 'http':
      return { error: 'upstream', reason: `gemini_http_${String(error.status)}` };
    default:
      return { error: 'upstream', reason: error.kind };
  }
}

export async function runAdvice(request: AdviceRequest, deps: AdviceDeps): Promise<AdviceOutcome> {
  const allowed = allowedNumbers(request.snapshot);
  let retryNote: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isPlan = request.mode === 'plan';
    const result = await callGemini({
      apiKey: deps.apiKey,
      model: deps.model,
      systemPrompt: isPlan ? PLAN_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT,
      userPrompt: isPlan
        ? buildPlanUserPrompt(request.snapshot, retryNote)
        : buildChatUserPrompt(request.snapshot, request.question, request.history, retryNote),
      responseJsonSchema: isPlan ? PLAN_JSON_SCHEMA : CHAT_JSON_SCHEMA,
      signal: deps.signal,
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
      ...(deps.timeoutMs ? { timeoutMs: deps.timeoutMs } : {}),
    });
    if (!result.ok) return { ok: false, ...mapGeminiError(result.error) };

    const schema: z.ZodType<AdvicePlan | ChatAnswer> = isPlan ? AdvicePlanSchema : ChatAnswerSchema;
    const parsed = schema.safeParse(result.value);
    if (!parsed.success) return { ok: false, error: 'invalid_output', reason: 'schema' };

    const texts = isPlan
      ? planTexts(parsed.data as AdvicePlan)
      : chatTexts(parsed.data as ChatAnswer);
    const ungrounded = ungroundedNumbers(texts, allowed);
    if (ungrounded.length === 0) {
      return isPlan
        ? {
            ok: true,
            mode: 'plan',
            data: parsed.data as AdvicePlan,
            model: deps.model,
            attempts: attempt,
          }
        : {
            ok: true,
            mode: 'chat',
            data: parsed.data as ChatAnswer,
            model: deps.model,
            attempts: attempt,
          };
    }
    retryNote = groundingRetryNote(ungrounded);
  }
  return { ok: false, error: 'invalid_output', reason: 'grounding' };
}
