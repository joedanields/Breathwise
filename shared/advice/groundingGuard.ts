// Numeric grounding guard (AI_DESIGN.md §7): every number in AI text must come
// from FACTS. Pure; shared by the Pages Function and BYOK.
import type { FactsSnapshot } from '../types';
import type { AdvicePlan, ChatAnswer } from './planSchema';

/** Names that contain digits but are not quantities. */
const NAMED_TOKENS =
  /\b(?:PM\s?2[.,]5|PM\s?10|NO2|SO2|O3|CO2|KN95|N95|FFP2|FFP3|[WVX][1-9])\b|NO₂|SO₂|O₃|CO₂|PM₂\.₅|PM₁₀/gi;

/** Small numbers and common durations that carry no data claim (AI_DESIGN.md §7). */
const ALWAYS_ALLOWED = [
  ...Array.from({ length: 11 }, (_, i) => i), // 0–10
  12,
  15,
  20,
  24,
  30,
  45,
  48,
  60,
  90,
  100,
  // Age-band bounds
  0,
  1,
  2,
  5,
  6,
  12,
  13,
  17,
  18,
  59,
  60,
];

/** Numbers in text, after removing pollutant/mask/window names and thousands separators. */
export function extractNumbers(text: string): number[] {
  const cleaned = text.replace(NAMED_TOKENS, ' ').replace(/(\d),(\d{3})\b/g, '$1$2');
  return Array.from(cleaned.matchAll(/\d+(?:\.\d+)?/g), (m) => Number(m[0]));
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/;

/** Every number a text may use: snapshot values (raw, 0 dp, 1 dp), times in 12/24 h, constants. */
export function allowedNumbers(snapshot: FactsSnapshot): number[] {
  const allowed = new Set<number>(ALWAYS_ALLOWED);
  const addNumber = (n: number) => {
    allowed.add(n);
    allowed.add(Math.round(n));
    allowed.add(Math.round(n * 10) / 10);
  };
  const visit = (value: unknown) => {
    if (typeof value === 'number') addNumber(value);
    else if (typeof value === 'string') {
      const time = ISO_TIME.exec(value);
      if (time) {
        const hour = Number(time[1]);
        allowed.add(hour);
        allowed.add(hour % 12 === 0 ? 12 : hour % 12);
        allowed.add(Number(time[2]));
      }
      extractNumbers(value).forEach(addNumber);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(snapshot);
  return [...allowed];
}

/** Numbers in `texts` not within ±0.5 of an allowed number (unique, in order of appearance). */
export function ungroundedNumbers(texts: readonly string[], allowed: readonly number[]): number[] {
  const bad = new Set<number>();
  for (const text of texts) {
    for (const n of extractNumbers(text)) {
      if (!allowed.some((a) => Math.abs(a - n) <= 0.5)) bad.add(n);
    }
  }
  return [...bad];
}

/** Every free-text field of a plan, for the grounding guard. */
export function planTexts(plan: AdvicePlan): string[] {
  const actions = [...plan.routine, ...plan.indoor].flatMap((a) => [
    a.title,
    a.when ?? '',
    a.why,
    a.impact,
  ]);
  return [
    plan.headline,
    plan.summary,
    ...actions,
    ...plan.impact.flatMap((i) => [i.title, i.health, i.emissions ?? '']),
    ...plan.memberNotes.map((m) => m.note),
    plan.seekCareIf,
  ];
}

/** The free-text fields of a chat answer, for the grounding guard. */
export function chatTexts(answer: ChatAnswer): string[] {
  return [answer.answer];
}
