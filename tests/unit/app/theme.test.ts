import { describe, expect, it, vi } from 'vitest';
import { applyTheme, DARK_SCHEME_QUERY, resolveTheme } from '@/app/theme';

function fakeMediaQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches,
    media: DARK_SCHEME_QUERY,
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
  };
  const setMatches = (next: boolean) => {
    media.matches = next;
    listeners.forEach((listener) => {
      listener();
    });
  };
  return { media, setMatches };
}

describe('resolveTheme', () => {
  it.each([
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)('%s with system dark=%s -> %s', (preference, systemDark, expected) => {
    expect(resolveTheme(preference, systemDark)).toBe(expected);
  });
});

describe('applyTheme', () => {
  it('follows the OS setting for "system" and stops after cleanup', () => {
    const { media, setMatches } = fakeMediaQuery(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    const root = document.createElement('html');

    const cleanup = applyTheme('system', root);
    expect(root.dataset.theme).toBe('light');

    setMatches(true);
    expect(root.dataset.theme).toBe('dark');

    cleanup();
    setMatches(false);
    expect(root.dataset.theme).toBe('dark');
    expect(media.removeEventListener).toHaveBeenCalledOnce();
  });

  it('applies an explicit preference without listening to the OS', () => {
    const { media } = fakeMediaQuery(true);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    const root = document.createElement('html');

    applyTheme('light', root);

    expect(root.dataset.theme).toBe('light');
    expect(media.addEventListener).not.toHaveBeenCalled();
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const root = document.createElement('html');

    applyTheme('system', root);

    expect(root.dataset.theme).toBe('light');
  });
});
