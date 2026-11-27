import type { ChatTurn } from '@shared/advice/requestSchema';
import { MAX_HISTORY_TURNS, MAX_QUESTION_CHARS } from '@shared/config';
import type { FactsSnapshot } from '@shared/types';
import { useRef, useState } from 'react';
import { requestAdvice } from '@/features/advice/transport';
import { byokStore } from '@/features/settings/byok';

export interface ChatMessage {
  id: number;
  role: 'user' | 'model' | 'notice';
  text: string;
  outOfScope?: boolean;
}

export const MIN_QUESTION_CHARS = 2;

const NOTICES = {
  rate_limited: 'Too many requests, try again in a minute.',
  auth: 'Your Gemini key was rejected; check it in Settings.',
  default: "Breathwise couldn't answer right now. Please try again in a moment.",
} as const;

/** The last ≤ 6 turns, oldest first (AI_DESIGN.md §1). */
export function historyForRequest(messages: readonly ChatMessage[]): ChatTurn[] {
  return messages
    .filter((m): m is ChatMessage & { role: 'user' | 'model' } => m.role !== 'notice')
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
}

export function validateQuestion(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < MIN_QUESTION_CHARS) return 'Type a question first.';
  if (trimmed.length > MAX_QUESTION_CHARS)
    return `Keep it under ${String(MAX_QUESTION_CHARS)} characters.`;
  return null;
}

/** Chat about today's air and plan (PRD US-6). Each answer is grounded like the plan. */
export function useChat(snapshot: FactsSnapshot) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);

  const add = (message: Omit<ChatMessage, 'id'>, list: ChatMessage[]) => [
    ...list,
    { ...message, id: nextId.current++ },
  ];

  async function ask(question: string) {
    const text = question.trim();
    const history = historyForRequest(messages);
    const withQuestion = add({ role: 'user', text }, messages);
    setMessages(withQuestion);
    setPending(true);
    const byok = byokStore.get();
    const result = await requestAdvice(
      { mode: 'chat', snapshot, question: text, history },
      { byokKey: byok && !byok.rejected ? byok.apiKey : undefined },
    );
    setPending(false);
    if (result.ok && result.mode === 'chat') {
      setMessages(
        add(
          { role: 'model', text: result.data.answer, outOfScope: result.data.outOfScope },
          withQuestion,
        ),
      );
      return;
    }
    const error = result.ok ? 'default' : result.error;
    if (error === 'auth' && byok) byokStore.set({ ...byok, rejected: true });
    setMessages(
      add(
        {
          role: 'notice',
          text: error in NOTICES ? NOTICES[error as keyof typeof NOTICES] : NOTICES.default,
        },
        withQuestion,
      ),
    );
  }

  return { messages, pending, ask };
}
