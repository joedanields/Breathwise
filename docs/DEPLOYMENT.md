# Deployment — Breathwise (Cloudflare Pages)

## 1. One-time setup

1. Push the repo to GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → select repo.
3. Build settings:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
   - Environment variable: `NODE_VERSION = 22`
4. The `functions/` directory is detected automatically and deployed as Pages Functions (`/api/advise`).
5. Project name `breathwise` → URL `https://breathwise.pages.dev` (choose another if taken; update `ALLOWED_ORIGINS` and README).

## 2. KV namespace for rate limiting

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
npx wrangler kv namespace create RATE_LIMIT_KV --preview
```

Put the returned ids in `wrangler.toml`:

```toml
name = "breathwise"
pages_build_output_dir = "dist"
compatibility_date = "2026-11-01"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<prod-id>"
preview_id = "<preview-id>"

[vars]
GEMINI_MODEL = "<latest stable Flash model id>"
ALLOWED_ORIGINS = "https://breathwise.pages.dev,http://localhost:5173,http://localhost:8788"
```

Preview deployments (`<hash>.breathwise.pages.dev`) are matched in code by suffix check for `.breathwise.pages.dev`.

## 3. Secrets

```bash
npx wrangler pages secret put GEMINI_API_KEY --project-name breathwise
```

Or Dashboard → project → **Settings → Variables and Secrets** → Add → type **Secret** → `GEMINI_API_KEY` (Production and Preview).

Never put the key in `wrangler.toml`, `.env`, or any `VITE_*` variable.

## 4. Local development

```bash
cp .dev.vars.example .dev.vars   # GEMINI_API_KEY=..., GEMINI_MODEL=..., ALLOWED_ORIGINS=...
npm run build
npm run dev:api                  # wrangler pages dev dist  → http://localhost:8788 (functions + static)
npm run dev                      # vite → http://localhost:5173, /api proxied to :8788
```

`.dev.vars` is git-ignored.

## 5. Gemini key hygiene

- Create a dedicated Google AI Studio key for this project.
- Set a quota/budget alert on the linked Google Cloud project.
- Rotate the key after the challenge ends.

## 6. Post-deploy checks

- [x] `curl -I https://breathwise.pages.dev` shows CSP and other headers from `_headers` (2026-11-28)
- [x] `curl -X POST https://breathwise.pages.dev/api/advise -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{}'` → 403 (2026-11-28)
- [x] Load each scenario; plan appears; provenance visible (smoke test, `docs/PROGRESS.md`)
- [x] No request contains the Gemini key, except BYOK calls to `generativelanguage.googleapis.com` (key only in the Function's env; header-only, tested)
- [ ] Lighthouse on production URL — **owner (manual)**

## 7. Rollback

Cloudflare Pages → Deployments → select previous deployment → **Rollback to this deployment**.
