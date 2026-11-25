export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Writes the resolved theme to `<html data-theme>` (read by the design tokens in
 * src/styles/index.css) and, while the preference is 'system', keeps it in sync
 * with the OS setting. Returns a cleanup function.
 */
export function applyTheme(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
): () => void {
  const media =
    typeof window.matchMedia === 'function' ? window.matchMedia(DARK_SCHEME_QUERY) : null;

  const update = (): void => {
    root.dataset.theme = resolveTheme(preference, media?.matches ?? false);
  };
  update();

  if (preference !== 'system' || media === null) {
    return () => undefined;
  }
  media.addEventListener('change', update);
  return () => {
    media.removeEventListener('change', update);
  };
}
