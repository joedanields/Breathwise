import type { AdvicePlan } from '@shared/advice/planSchema';
import { AdvicePlanSchema } from '@shared/advice/planSchema';
import type { FactsSnapshot } from '@shared/types';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { byokStore } from '@/features/settings/byok';
import { stableHash } from '@/lib/hash';
import { STORAGE_PREFIX } from '@/lib/localStore';
import { getSessionStorage, readStored, writeStored } from '@/lib/storage';
import { buildFallbackPlan, FALLBACK_NOTICE } from './fallbackPlan';
import { requestAdvice } from './transport';

export interface PlanResult {
  plan: AdvicePlan;
  source: 'ai' | 'fallback';
  /** Why the fallback is shown (user-facing), when it is. */
  notice?: string;
  model?: string;
}

/**
 * ARCHITECTURE.md §5: one plan per (location 2 dp, reading hour, profile, language).
 * The snapshot itself changes every minute, so it is not part of the key.
 */
export function adviceCacheKey(snapshot: FactsSnapshot): string {
  return stableHash({
    lat: snapshot.location.latRounded,
    lon: snapshot.location.lonRounded,
    readingHour: snapshot.provenance.readingTime.slice(0, 13),
    profile: stableHash(snapshot.profile),
    language: snapshot.profile.language,
  });
}

const CachedPlanSchema = z.strictObject({ plan: AdvicePlanSchema, model: z.string() });
const cacheStorageKey = (key: string) => `${STORAGE_PREFIX}plan.${key}`;

function noticeFor(error: string): string {
  if (error === 'rate_limited')
    return `Too many requests, try again in a minute. ${FALLBACK_NOTICE}`;
  if (error === 'auth')
    return `Your Gemini key was rejected; check it in Settings. ${FALLBACK_NOTICE}`;
  return FALLBACK_NOTICE;
}

/** Fetches the AI plan once per cache key; any failure yields the rules-based plan. */
export async function loadPlan(
  snapshot: FactsSnapshot,
  { bypassCache = false, signal }: { bypassCache?: boolean; signal?: AbortSignal } = {},
): Promise<PlanResult> {
  const storage = getSessionStorage();
  const key = cacheStorageKey(adviceCacheKey(snapshot));
  if (!bypassCache) {
    const cached = readStored(storage, key, CachedPlanSchema);
    if (cached) return { plan: cached.plan, source: 'ai', model: cached.model };
  }
  const byok = byokStore.get();
  const result = await requestAdvice(
    { mode: 'plan', snapshot },
    { byokKey: byok && !byok.rejected ? byok.apiKey : undefined, ...(signal ? { signal } : {}) },
  );
  if (result.ok && result.mode === 'plan') {
    writeStored(storage, key, { plan: result.data, model: result.model });
    return { plan: result.data, source: 'ai', model: result.model };
  }
  if (!result.ok && result.error === 'auth' && byok) byokStore.set({ ...byok, rejected: true });
  return {
    plan: buildFallbackPlan(snapshot),
    source: 'fallback',
    notice: noticeFor(result.ok ? 'invalid_output' : result.error),
  };
}

export function useAdvice(snapshot: FactsSnapshot | null) {
  const key = snapshot ? adviceCacheKey(snapshot) : 'none';
  return useQuery({
    queryKey: ['advice', key],
    queryFn: ({ signal }) => {
      if (!snapshot) throw new Error('no snapshot');
      return loadPlan(snapshot, { signal });
    },
    enabled: snapshot !== null,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
