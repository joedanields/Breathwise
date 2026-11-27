// Shared limits and defaults (SPA + Pages Function). Never put secrets here.

/** Fallback when GEMINI_MODEL is unset (DATA_SOURCES.md §5); the env var wins. */
export const DEFAULT_MODEL = 'gemini-3.8-flash';
/** Cheaper fallback model, switched via GEMINI_MODEL (no code change). */
export const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const GEMINI_TIMEOUT_MS = 20_000;
export const TEMPERATURE = 0.4;
/** Headroom for models that spend output tokens on internal reasoning. */
export const MAX_OUTPUT_TOKENS = 8192;

/** /api/advise limits (SECURITY.md §3). */
export const MAX_BODY_BYTES = 24 * 1024;
export const RATE_LIMIT_PER_MINUTE = 10;
export const DAILY_REQUEST_CAP = 2000;

/** Chat limits (PRD US-6, Phase 7). */
export const MAX_QUESTION_CHARS = 500;
export const MAX_HISTORY_TURNS = 6;
