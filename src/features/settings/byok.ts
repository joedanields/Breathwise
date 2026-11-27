import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { createLocalStore, STORAGE_PREFIX } from '@/lib/localStore';
import { getSessionStorage } from '@/lib/storage';

/**
 * "Use my own Gemini key" (PRD US-8, SECURITY.md §1): sessionStorage only, so it
 * is gone when the tab closes; never sent to our server; cleared by "Clear all".
 */
export const BYOK_KEY = `${STORAGE_PREFIX}byok.v1`;

const ByokSchema = z.strictObject({
  apiKey: z.string().trim().min(10).max(200),
  /** Set when Gemini rejected the key (401/403), shown inline in Settings. */
  rejected: z.boolean(),
});
export type Byok = z.infer<typeof ByokSchema>;

export const byokStore = createLocalStore({
  key: BYOK_KEY,
  schema: ByokSchema,
  fallback: null,
  storage: getSessionStorage(),
});

export function useByok() {
  return useSyncExternalStore(byokStore.subscribe, byokStore.get, byokStore.get);
}
