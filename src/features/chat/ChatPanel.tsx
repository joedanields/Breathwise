import { MAX_QUESTION_CHARS } from '@shared/config';
import type { FactsSnapshot, HouseholdProfile } from '@shared/types';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { type ChatMessage, useChat, validateQuestion } from './useChat';

const SPEAKER: Readonly<Record<ChatMessage['role'], string>> = {
  user: 'You',
  model: 'Breathwise',
  notice: 'Notice',
};

/**
 * "Ask Breathwise" (UI_UX.md §4 ChatPanel): labelled textarea with a counter,
 * a role="log" message list, answers rendered as plain text.
 */
export default function ChatPanel({ snapshot }: { snapshot: FactsSnapshot }) {
  const { messages, pending, ask } = useChat(snapshot);
  return (
    <div className="space-y-3">
      <MessageLog messages={messages} pending={pending} language={snapshot.profile.language} />
      <QuestionForm
        pending={pending}
        onAsk={(question) => {
          void ask(question);
        }}
      />
    </div>
  );
}

function MessageLog({
  messages,
  pending,
  language,
}: {
  messages: readonly ChatMessage[];
  pending: boolean;
  language: HouseholdProfile['language'];
}) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      className="max-h-96 space-y-2 overflow-y-auto"
      // A scrollable log must be keyboard-focusable (WCAG 2.1.1); allowed in eslint.config.js.
      tabIndex={0}
    >
      {messages.length === 0 && (
        <p className="text-muted">
          Ask about today&apos;s air, the best times, or your plan. Answers use only today&apos;s
          data.
        </p>
      )}
      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-md p-3 ${m.role === 'user' ? 'ml-8 bg-bg' : 'mr-8 border border-border'}`}
          {...(m.role === 'model' ? { lang: language } : {})}
        >
          <p className="text-xs font-semibold text-muted">{SPEAKER[m.role]}</p>
          <p className="mt-1 whitespace-pre-line">{m.text}</p>
        </div>
      ))}
      {pending && (
        <p role="status" className="text-muted">
          Breathwise is answering…
        </p>
      )}
    </div>
  );
}

/** The question box: validates on submit, then clears and hands the question on. */
function QuestionForm({ pending, onAsk }: { pending: boolean; onAsk: (question: string) => void }) {
  const id = useId();
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const inputId = `${id}-question`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = validateQuestion(question);
        setError(problem ?? '');
        if (problem || pending) return;
        setQuestion('');
        onAsk(question);
      }}
    >
      <label htmlFor={inputId} className="block font-medium">
        Your question
      </label>
      <textarea
        id={inputId}
        rows={3}
        maxLength={MAX_QUESTION_CHARS}
        value={question}
        aria-invalid={error ? true : undefined}
        aria-describedby={[counterId, error ? errorId : ''].filter(Boolean).join(' ')}
        onChange={(event) => {
          setQuestion(event.target.value);
        }}
        className="block w-full rounded-md border border-muted bg-surface p-3 text-text"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={counterId} className="text-sm text-muted">
          {question.length} of {MAX_QUESTION_CHARS} characters
        </p>
        <Button type="submit" disabled={pending}>
          Ask
        </Button>
      </div>
      {error && (
        <p id={errorId} className="font-medium text-aqi-very-poor dark:text-text">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">General guidance, not medical advice.</p>
    </form>
  );
}
