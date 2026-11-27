// AdvicePlan and ChatAnswer (AI_DESIGN.md §5). No field holds AQI or pollutant
// numbers; numbers may only appear inside text, checked by the grounding guard.
import { z } from 'zod';

const Category = z.enum([
  'activity',
  'commute',
  'errand',
  'mask',
  'purifier',
  'ventilation',
  'sealing',
  'cooking',
  'plants',
  'health',
  'other',
]);
const Priority = z.enum(['high', 'medium', 'low']);

export const ActionSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(90).describe('Imperative, e.g. "Move Aarav\'s play time to W1"'),
  when: z.string().max(60).optional().describe('A window label or time that appears in FACTS'),
  windowRef: z.string().max(4).optional().describe('W1, W2, V1, V2, X1 or X2'),
  forMembers: z.array(z.string().max(64)).max(8).describe('Member ids, or ["all"]'),
  category: Category,
  priority: Priority,
  why: z.string().min(1).max(280).describe('Cause and effect, grounded in FACTS'),
  impact: z.string().min(1).max(200).describe('Health and/or emissions effect'),
  impactFactId: z.string().max(40).optional().describe('id from FACTS.impactFacts when citing it'),
});

export const AdvicePlanSchema = z.object({
  headline: z.string().min(1).max(120),
  summary: z.string().min(1).max(400),
  routine: z.array(ActionSchema).min(1).max(6),
  indoor: z.array(ActionSchema).min(1).max(6),
  impact: z
    .array(
      z.object({
        title: z.string().min(1).max(90),
        health: z.string().min(1).max(240),
        emissions: z.string().max(200).optional(),
        impactFactId: z.string().max(40).optional(),
      }),
    )
    .min(1)
    .max(5),
  memberNotes: z
    .array(z.object({ memberId: z.string().max(64), note: z.string().min(1).max(200) }))
    .max(8),
  seekCareIf: z.string().min(1).max(200),
});

export type AdvicePlan = z.infer<typeof AdvicePlanSchema>;
export type AdviceAction = z.infer<typeof ActionSchema>;

export const ChatAnswerSchema = z.object({
  answer: z.string().min(1).max(900),
  relatedWindowRefs: z.array(z.string().max(4)).max(3),
  outOfScope: z.boolean(),
});

export type ChatAnswer = z.infer<typeof ChatAnswerSchema>;

/**
 * JSON Schema keywords sent to Gemini. Length and count limits ("maxItems",
 * "minItems") and descriptions make the constrained decoder too large ("too many
 * states for serving"), so they are left out here; Zod enforces them on the reply.
 */
const GEMINI_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'enum',
  'items',
  'additionalProperties',
]);

function pick(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(pick);
  if (node === null || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!GEMINI_KEYWORDS.has(key)) continue;
    out[key] =
      key === 'properties'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, pick(v)]),
          )
        : pick(value);
  }
  return out;
}

/** The Zod schema as JSON Schema limited to the keywords Gemini supports. */
export function toGeminiSchema(schema: z.ZodType): unknown {
  return pick(z.toJSONSchema(schema, { io: 'output' }));
}
