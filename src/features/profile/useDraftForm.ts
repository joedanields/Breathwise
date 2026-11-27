import { useState } from 'react';
import type { DraftErrors, ProfileDraft } from './profileDraft';

/**
 * Draft + errors for a profile form. `check` runs a validator, shows the errors
 * and moves focus to the first invalid control (UI_UX.md §6). Returns true when valid.
 */
export function useDraftForm(initial: () => ProfileDraft, idPrefix: string) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<DraftErrors>({});

  function check(...validators: ((draft: ProfileDraft) => DraftErrors)[]): boolean {
    const next = Object.assign({}, ...validators.map((validate) => validate(draft))) as DraftErrors;
    setErrors(next);
    const [first] = Object.keys(next);
    if (first === undefined) return true;
    // Wait for the error messages to render, then focus the first invalid control.
    requestAnimationFrame(() => {
      document.getElementById(`${idPrefix}-${first}`)?.focus();
    });
    return false;
  }

  return { draft, setDraft, errors, check, errorCount: Object.keys(errors).length };
}
