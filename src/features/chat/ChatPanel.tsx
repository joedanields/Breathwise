import { MAX_QUESTION_CHARS } from '@shared/config';
import type { FactsSnapshot } from '@shared/types';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useChat, validateQuestion } from './useChat';

/**
 * "Ask Breathwise" (UI_UX.md §4 ChatPanel): labelled textarea with a counter,
 * a role="log" message list, answers rendered as plain text.
 */
export default function ChatPanel({ snapshot }: { snapshot: FactsSnapshot }) {
  const id = useId();
  const { messages, pending, ask } = useChat(snapshot);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const inputId = `${id}-question`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  const language = snapshot.profile.language;

  return (
    <div className="space-y-3">
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
            <p className="text-xs font-semibold text-muted">
              {m.role === 'user' ? 'You' : m.role === 'model' ? 'Breathwise' : 'Notice'}
            </p>
            <p className="mt-1 whitespace-pre-line">{m.text}</p>
          </div>
        ))}
        {pending && (
          <p role="status" className="text-muted">
            Breathwise is answering…
          </p>
        )}
      </div>

      <form
        noValidate
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const problem = validateQuestion(question);
          setError(problem ?? '');
          if (problem || pending) return;
          setQuestion('');
          void ask(question);
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
    </div>
  );
}
