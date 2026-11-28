# Security — Breathwise

## 1. Threat model (summary)

| Asset | Threat | Mitigation |
|---|---|---|
| Gemini API key (server) | Leak via repo, bundle, logs | Cloudflare encrypted secret; never in client bundle; secret scanning in CI; never logged |
| Gemini quota | Abuse of `/api/advise` as free LLM | Server-built prompts only (no raw prompt passthrough), Zod-validated structured input, origin check, per-IP rate limit, body size cap, daily cap |
| User's BYOK key | Theft via XSS / persistence | `sessionStorage` only, cleared on tab close or "Clear"; strict CSP; no third-party scripts; never sent to our server |
| User profile (health conditions) | Exposure | Stored only in `localStorage`; sent only inside the AI request; coordinates rounded; no analytics |
| UI | XSS via AI output or API data | Render as text; no `dangerouslySetInnerHTML`; CSP `script-src 'self'` |
| AI behaviour | Prompt injection via chat | Delimited question, system rules, schema-constrained output, out-of-scope flag, output rendered as text |
| Supply chain | Malicious dependency | Minimal deps, lockfile committed, `npm audit` in CI, Dependabot |

## 2. Secrets handling

- `.gitignore` includes: `.env`, `.env.*` (except `.env.example`), `.dev.vars`, `*.local`.
- `.dev.vars.example` and `.env.example` contain names only, no values.
- Production: `npx wrangler pages secret put GEMINI_API_KEY` or Dashboard → Settings → Variables and Secrets (type **Secret**).
- **Never** prefix the Gemini key with `VITE_` — anything `VITE_*` is bundled into client JS.
- CI runs `gitleaks` (or GitHub secret scanning) on every push.
- In Google AI Studio / Cloud Console: set a quota cap on the project used by the key.

## 3. `/api/advise` hardening (`functions/api/advise.ts`)

Order of checks:

1. **Method**: `POST` only (else 405). Handle `OPTIONS` only if cross-origin is ever needed (it isn't — same origin).
2. **Origin**: `Origin` header must be in `ALLOWED_ORIGINS` (prod domain, `*.breathwise.pages.dev` previews, `http://localhost:5173`). Else 403.
3. **Content-Type**: `application/json`. Else 415.
4. **Size**: reject if `Content-Length` > 16 KB or body exceeds 16 KB when read. 413.
5. **Validate**: `AdviceRequest.safeParse`. Else 400 with generic message (no schema dump).
6. **Rate limit**: KV key `rl:{ip}:{minute}` → max 10/min; `rl:day:{yyyy-mm-dd}` → global daily cap (e.g. 2,000). 429 with `Retry-After`. Note KV is eventually consistent — acceptable as a soft limit. If Cloudflare's Workers Rate Limiting binding is available for Pages Functions, prefer it.
7. **Call Gemini** with 20 s timeout; map upstream errors to `upstream` (no upstream body echoed).
8. **Validate output** (Zod) → `invalid_output` on failure.
9. Response headers: `Content-Type: application/json`, `Cache-Control: no-store`.

IP from `request.headers.get('CF-Connecting-IP')`.

## 4. HTTP security headers (`public/_headers`)

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://air-quality-api.open-meteo.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net https://generativelanguage.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

`X-Frame-Options: DENY` repeats `frame-ancestors 'none'` for older browsers.

**API responses.** Pages does not apply `_headers` to Pages Function responses, so `functions/api/advise.ts` sets its own (`API_SECURITY_HEADERS`, unit-tested on success and error responses): `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, `Strict-Transport-Security`, plus `Cache-Control: no-store`.

If a library requires inline style attributes, add `'unsafe-inline'` to `style-src` **only**, and note why here. Never relax `script-src`.

**Why `style-src` has `'unsafe-inline'` (2026-11-28):** Radix Dialog's modal scroll lock (`react-remove-scroll-bar`) injects a `<style>` element and sets inline styles when a sheet or dialog opens. The e2e CSP check (`tests/e2e/support/stubs.ts`, applied to every page) recorded `style-src-elem` violations without it. A nonce is not possible on static Pages. Inline styles cannot run code, and `script-src 'self'` stays strict: Zod runs in jitless mode (`shared/zodConfig.ts`) so it never probes `eval`, and the same e2e check fails on any `script-src` violation.

## 5. Client-side rules

- All external responses parsed with Zod before use.
- `localStorage` reads parsed with Zod; on failure, discard and reset.
- No personal data in URLs or query strings (location name in UI state, not URL).
- External links: `rel="noopener noreferrer"`.
- No third-party analytics, fonts or CDNs at runtime.

## 6. Privacy statement (shown in About)

Breathwise has no accounts and no tracking. Your household details stay in this browser. When you generate a plan, a summary of today's air data and your household details (without exact location) is sent to Google's Gemini API through our server, or directly if you use your own key. Clear everything anytime in Settings.

## 7. Responsible AI

- Not medical advice; `seekCareIf` always present.
- Conservative defaults for sensitive members.
- AI never generates environmental data; numeric grounding guard.
- Honest about the limits of plants, cloth masks and modelled data.
