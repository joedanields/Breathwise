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
  normaliseChatAnswer,
  normalisePlan,
  toGeminiSchema,
} from './planSchema';
import {
  buildChatUserPrompt,
  buildPlanUserPrompt,
  CHAT_SYSTEM_PROMPT,
  groundingRetryNote,
  PLAN_SYSTEM_PROMPT,
  SCHEMA_RETRY_NOTE,
} from './prompt';
import type { AdviceError, AdviceRequest } from './requestSchema';
import type { FactsSnapshot } from '../types';

/** Result of `runAdvice`: a validated plan or chat answer, or an error with a log-only reason. */
export type AdviceOutcome =
  | { ok: true; mode: 'plan'; data: AdvicePlan; model: string; attempts: number }
  | { ok: true; mode: 'chat'; data: ChatAnswer; model: string; attempts: number }
  | { ok: false; error: AdviceError; reason: string };

/** API key, model and transport options for `runAdvice`. */
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
      return {
        error: 'upstream',
        reason: `gemini_http_${String(error.status)}${error.detail ? `: ${error.detail}` : ''}`,
      };
    default:
      return { error: 'upstream', reason: error.kind };
  }
}

/** How one advice mode (plan or chat) prompts Gemini and checks its output. */
interface ModeSpec<T> {
  systemPrompt: string;
  responseJsonSchema: unknown;
  userPrompt: (retryNote: string | undefined) => string;
  normalise: (value: unknown) => unknown;
  schema: z.ZodType<T>;
  texts: (data: T) => string[];
}

type Validated<T> =
  { ok: true; data: T; attempts: number } | { ok: false; error: AdviceError; reason: string };

function planSpec(snapshot: FactsSnapshot): ModeSpec<AdvicePlan> {
  return {
    systemPrompt: PLAN_SYSTEM_PROMPT,
    responseJsonSchema: PLAN_JSON_SCHEMA,
    userPrompt: (retryNote) => buildPlanUserPrompt(snapshot, retryNote),
    normalise: normalisePlan,
    schema: AdvicePlanSchema,
    texts: planTexts,
  };
}

function chatSpec(request: Extract<AdviceRequest, { mode: 'chat' }>): ModeSpec<ChatAnswer> {
  const { snapshot, question, history } = request;
  return {
    systemPrompt: CHAT_SYSTEM_PROMPT,
    responseJsonSchema: CHAT_JSON_SCHEMA,
    userPrompt: (retryNote) => buildChatUserPrompt(snapshot, question, history, retryNote),
    normalise: normaliseChatAnswer,
    schema: ChatAnswerSchema,
    texts: chatTexts,
  };
}

/** Prompt → Gemini → normalise → Zod → grounding guard, with one retry on a schema or grounding failure. */
async function generateValidated<T>(
  spec: ModeSpec<T>,
  allowed: readonly number[],
  deps: AdviceDeps,
): Promise<Validated<T>> {
  let retryNote: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await callGemini({
      apiKey: deps.apiKey,
      model: deps.model,
      systemPrompt: spec.systemPrompt,
      userPrompt: spec.userPrompt(retryNote),
      responseJsonSchema: spec.responseJsonSchema,
      signal: deps.signal,
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
      ...(deps.timeoutMs ? { timeoutMs: deps.timeoutMs } : {}),
    });
    if (!result.ok) return { ok: false, ...mapGeminiError(result.error) };

    const parsed = spec.schema.safeParse(spec.normalise(result.value));
    if (!parsed.success) {
      if (attempt === MAX_ATTEMPTS) return { ok: false, error: 'invalid_output', reason: 'schema' };
      retryNote = SCHEMA_RETRY_NOTE;
      continue;
    }
    const ungrounded = ungroundedNumbers(spec.texts(parsed.data), allowed);
    if (ungrounded.length === 0) return { ok: true, data: parsed.data, attempts: attempt };
    retryNote = groundingRetryNote(ungrounded);
  }
  return { ok: false, error: 'invalid_output', reason: 'grounding' };
}

/** Calls Gemini, validates and grounds the output, and retries once on a schema or grounding failure. */
export async function runAdvice(request: AdviceRequest, deps: AdviceDeps): Promise<AdviceOutcome> {
  const allowed = allowedNumbers(request.snapshot);
  const { model } = deps;
  if (request.mode === 'plan') {
    const plan = await generateValidated(planSpec(request.snapshot), allowed, deps);
    return plan.ok
      ? { ok: true, mode: 'plan', data: plan.data, model, attempts: plan.attempts }
      : plan;
  }
  const chat = await generateValidated(chatSpec(request), allowed, deps);
  return chat.ok
    ? { ok: true, mode: 'chat', data: chat.data, model, attempts: chat.attempts }
    : chat;
}
