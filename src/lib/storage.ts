import type { z } from 'zod';

/**
 * Safe Web Storage wrappers. Storage can be missing or throw (private mode,
 * blocked cookies, quota), and stored data can be stale or tampered with, so
 * every read is parsed with a Zod schema and bad data is removed.
 */

export function getLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function getSessionStorage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readStored<S extends z.ZodType>(
  storage: Storage | undefined,
  key: string,
  schema: S,
): z.output<S> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // Unreadable storage or invalid JSON: handled below like a schema mismatch.
  }
  removeStored(storage, key);
  return null;
}

export function writeStored(storage: Storage | undefined, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing more to do: the storage is unusable.
  }
}
