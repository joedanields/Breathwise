// /api/advise request and response (AI_DESIGN.md §3).
import { z } from 'zod';
import { MAX_HISTORY_TURNS, MAX_QUESTION_CHARS } from '../config';
import { FactsSnapshotSchema } from '../factsSnapshot';
import { AdvicePlanSchema, ChatAnswerSchema } from './planSchema';

export const ChatTurnSchema = z.strictObject({
  role: z.enum(['user', 'model']),
  text: z.string().max(2000),
});

export const AdviceRequestSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('plan'), snapshot: FactsSnapshotSchema }),
  z.strictObject({
    mode: z.literal('chat'),
    snapshot: FactsSnapshotSchema,
    question: z.string().trim().min(2).max(MAX_QUESTION_CHARS),
    history: z.array(ChatTurnSchema).max(MAX_HISTORY_TURNS),
  }),
]);

export type AdviceRequest = z.infer<typeof AdviceRequestSchema>;
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const ADVICE_ERRORS = [
  'bad_request',
  'forbidden',
  'rate_limited',
  'upstream',
  'invalid_output',
  'unsupported_media_type',
  'payload_too_large',
  'method_not_allowed',
  'auth',
] as const;
export type AdviceError = (typeof ADVICE_ERRORS)[number];

export const AdviceResponseSchema = z.union([
  z.strictObject({
    ok: z.literal(true),
    mode: z.literal('plan'),
    data: AdvicePlanSchema,
    model: z.string(),
    cached: z.boolean(),
  }),
  z.strictObject({
    ok: z.literal(true),
    mode: z.literal('chat'),
    data: ChatAnswerSchema,
    model: z.string(),
    cached: z.boolean(),
  }),
  z.strictObject({ ok: z.literal(false), error: z.enum(ADVICE_ERRORS) }),
]);

export type AdviceResponse = z.infer<typeof AdviceResponseSchema>;
