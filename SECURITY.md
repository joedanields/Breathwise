# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://github.com/joedanields/Breathwise/security/advisories/new)
rather than in a public issue. Include the steps to reproduce and the impact you expect.

## Supported versions

Only the latest deploy of `main` (https://breathwise.pages.dev) is supported.

## How Breathwise is hardened

The full threat model and controls are in [docs/SECURITY.md](docs/SECURITY.md). In short:

- **Secrets:** the Gemini key lives only in Cloudflare (or a git-ignored `.dev.vars`); a
  bring-your-own key stays in `sessionStorage` and is sent only to Google. CI runs gitleaks
  over the full history.
- **`/api/advise`:** POST only, origin allow-list, JSON content type, a 16 KB body limit,
  Zod validation, a per-IP and daily rate limit in KV, a Gemini timeout, and no logging of
  profiles, prompts or keys. It builds its own prompts, so it is not an open Gemini proxy.
- **AI output:** validated with Zod, checked by a numeric grounding guard, and rendered as
  text only (no `dangerouslySetInnerHTML`, enforced by ESLint).
- **Browser:** a strict CSP (`script-src 'self'`, no `eval`), HSTS, `nosniff`,
  `frame-ancestors 'none'` and a minimal Permissions-Policy.
- **Dependencies:** `npm audit` in CI and weekly Dependabot updates.
