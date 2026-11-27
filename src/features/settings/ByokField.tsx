import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { byokStore, useByok } from './byok';

/**
 * "Use my own Gemini key" (UI_UX.md §4 ByokField): password input, show/hide,
 * clear. Stored in sessionStorage only and sent straight to Google, never to us.
 */
export function ByokField() {
  const id = useId();
  const byok = useByok();
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const inputId = `${id}-key`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const message =
    error ||
    (byok?.rejected
      ? 'Gemini rejected this key. Check it, or clear it to use the Breathwise server.'
      : '');

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-2">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Use my own Gemini key
      </h3>
      <p id={hintId} className="text-sm text-muted">
        Optional. Kept only in this browser tab (cleared when you close it) and sent directly to
        Google, never to the Breathwise server.
      </p>
      {byok ? (
        <div className="space-y-2">
          <p className="font-medium">
            A key is saved for this tab{byok.rejected ? ' (rejected)' : ''}.
          </p>
          {message && (
            <p id={errorId} className="font-medium text-aqi-very-poor dark:text-text">
              {message}
            </p>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              byokStore.clear();
              setError('');
            }}
          >
            Clear key
          </Button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const key = value.trim();
            if (key.length < 10) {
              setError('Enter the full API key.');
              return;
            }
            byokStore.set({ apiKey: key, rejected: false });
            setValue('');
            setError('');
          }}
        >
          <label htmlFor={inputId} className="block font-medium">
            Gemini API key
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              type={visible ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={[hintId, error ? errorId : ''].filter(Boolean).join(' ')}
              onChange={(event) => {
                setValue(event.target.value);
              }}
              className="min-h-11 flex-1 rounded-md border border-muted bg-surface px-3 text-text"
            />
            <Button
              variant="secondary"
              aria-pressed={visible}
              onClick={() => {
                setVisible(!visible);
              }}
            >
              {visible ? 'Hide' : 'Show'}
            </Button>
          </div>
          {error && (
            <p id={errorId} className="font-medium text-aqi-very-poor dark:text-text">
              {error}
            </p>
          )}
          <Button type="submit">Save key for this tab</Button>
        </form>
      )}
    </section>
  );
}
