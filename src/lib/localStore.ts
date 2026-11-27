import type { z } from 'zod';
import { readStored, removeStored, writeStored } from './storage';

/** Every key Breathwise writes starts with this, so "Clear all my data" can find them. */
export const STORAGE_PREFIX = 'breathwise.';

export interface LocalStore<T> {
  /** Current value; the same reference until it changes (for useSyncExternalStore). */
  get: () => T;
  set: (value: T) => void;
  /** Back to the fallback, and remove the stored key. */
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
}

interface Options<S extends z.ZodType, F> {
  key: string;
  schema: S;
  fallback: F;
  storage: Storage | undefined;
  /** When false, values are kept in memory only (e.g. "Remember location" off). */
  persist?: () => boolean;
}

/**
 * A small external store over Web Storage. Reads are Zod-validated: a corrupt or
 * outdated value is removed and replaced by the fallback, never a crash
 * (SECURITY.md §5). Other tabs' changes arrive through `storage` events.
 */
export function createLocalStore<S extends z.ZodType, F>({
  key,
  schema,
  fallback,
  storage,
  persist = () => true,
}: Options<S, F>): LocalStore<z.output<S> | F> {
  type T = z.output<S> | F;
  const listeners = new Set<() => void>();
  const read = (): T => readStored(storage, key, schema) ?? fallback;
  let value: T = read();

  const emit = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    value = read();
    emit();
  };

  return {
    get: () => value,
    set: (next) => {
      value = next;
      if (persist()) writeStored(storage, key, next);
      else removeStored(storage, key);
      emit();
    },
    clear: () => {
      value = fallback;
      removeStored(storage, key);
      emit();
    },
    subscribe: (listener) => {
      if (listeners.size === 0) window.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
  };
}

/** Removes every Breathwise key (and nothing else) from the given storages. */
export function clearAppStorage(storages: readonly (Storage | undefined)[]): void {
  for (const storage of storages) {
    if (!storage) continue;
    try {
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
        (k): k is string => k?.startsWith(STORAGE_PREFIX) === true,
      );
      keys.forEach((k) => {
        storage.removeItem(k);
      });
    } catch {
      // Storage unusable: nothing to clear.
    }
  }
}
