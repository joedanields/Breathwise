# CLAUDE.md — Breathwise

Instructions for Claude Code when working in this repository. Read this file fully before every task.

## What we are building

**Breathwise** is a GenAI-powered urban air-quality assistant for India. It fetches **live** air-quality and weather data for any Indian location, computes India's National AQI (NAQI) and safe-time windows in deterministic code, and uses Gemini to turn those facts into a personalised daily plan for a household (parents, seniors, commuters, students).

Built for **Prompt Wars Virtual – Challenge 6 (Urban Air Quality Assistant)**. Scoring covers code quality, security, efficiency, testing, accessibility and problem-statement alignment — treat every one as a first-class requirement.

## Read these docs before coding

| When you are… | Read |
|---|---|
| Starting any task | `docs/IMPLEMENTATION_PLAN.md` (find the current phase + unchecked tasks) |
| Touching product behaviour | `docs/PRD.md` |
| Creating files / modules | `docs/ARCHITECTURE.md` |
| Calling external APIs | `docs/DATA_SOURCES.md` |
| AQI maths, time windows, persona thresholds | `docs/AQI_AND_RULES.md` |
| Anything Gemini / prompts / schemas | `docs/AI_DESIGN.md` |
| UI, components, a11y | `docs/UI_UX.md` |
| Secrets, headers, proxy | `docs/SECURITY.md` |
| Tests | `docs/TESTING.md`, `docs/TEST_SCENARIOS.md` |
| Deploying | `docs/DEPLOYMENT.md` |
| Why a choice was made | `docs/DECISIONS.md` |
| Changing a runtime prompt or schema | `docs/PROMPT_LOG.md` (add an entry) |
| Preparing the submission | `docs/SUBMISSION.md` |

## Non-negotiable rules

1. **No mock, static, or AI-generated AQI at runtime.** Every pollutant value shown comes from a live API response fetched in this session. Fixtures and MSW handlers live **only** under `tests/` and must never be imported from `src/`, `shared/` or `functions/` (enforced by ESLint `no-restricted-imports`).
2. **Code computes, AI interprets.** NAQI, categories, best-time windows, trend, and CO₂ estimates are computed by pure TypeScript functions. Gemini receives a `FactsSnapshot` and returns text + structure only. The AI output schema contains **no AQI/pollutant numeric fields**.
3. **No secrets in the repo.** Never write an API key into source, config, tests, docs, or commit messages. Server secrets live in Cloudflare (`GEMINI_API_KEY`) or a git-ignored `.dev.vars`. BYOK keys live in `sessionStorage` only.
4. **Always show data provenance.** Any screen that shows air-quality values also shows the source name, reading time, fetched-at time, and the "modelled estimate" note.
5. **Never render AI output as HTML.** No `dangerouslySetInnerHTML`, no markdown-to-HTML on model output. Render as text nodes.
6. **Validate every boundary with Zod**: external API responses, `/api/advise` request bodies, Gemini responses, and data read from `localStorage`.
7. **Pan-India.** Never hard-code a city. Default location is "ask the user" (GPS or search), not Delhi.
8. **Accessibility is a requirement**: WCAG 2.2 AA, keyboard-complete, colour never the only signal.

## Tech stack

- Vite + React 19 + TypeScript (strict) — static SPA
- Tailwind CSS v4 (`@tailwindcss/vite`) + Radix UI primitives
- TanStack Query for server state; small custom store (React context + `useSyncExternalStore`) for profile/settings
- Zod for validation
- Gemini via **REST** (`generativelanguage.googleapis.com/v1beta`) — same request builder used by the Pages Function and BYOK mode
- Cloudflare Pages + Pages Functions (`functions/api/advise.ts`)
- Vitest + React Testing Library + MSW; Playwright + `@axe-core/playwright`
- ESLint (typescript-eslint, jsx-a11y, react-hooks) + Prettier

## Commands (create these scripts in Phase 1)

```bash
npm run dev          # Vite dev server (proxies /api to wrangler on :8788)
npm run dev:api      # wrangler pages dev dist  (needs a prior build + .dev.vars)
npm run build        # tsc -b && vite build
npm run preview      # vite preview
npm run lint         # eslint .
npm run typecheck    # tsc -b --noEmit
npm run test         # vitest run
npm run test:watch   # vitest
npm run test:cov     # vitest run --coverage
npm run e2e          # playwright test
npm run check        # lint + typecheck + test  (run before every commit)
```

## Coding conventions

- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any`; use `unknown` + Zod.
- Feature-folder structure (see `docs/ARCHITECTURE.md`). Pure logic in `src/lib/**` or `shared/**` has **zero React imports**.
- Functions small and named for what they return (`computeNaqi`, `findBestWindows`).
- Units in names when ambiguous: `pm25Ugm3`, `coMgm3`, `windKmh`.
- Times: store ISO strings with offset; display in the location's timezone (`Asia/Kolkata` for India).
- Errors: typed `Result`-style returns in `lib/`; UI shows friendly messages + retry. Never swallow errors silently.
- Components: accessible by default (labels, roles, focus states). Prefer Radix primitives over hand-rolled widgets.
- No new dependency without a one-line justification in the PR/commit body. Keep bundle lean.

## Testing expectations

- Write tests **first** for everything in `src/lib/**` and `shared/**` (NAQI, averages, windows, emissions, prompt builder, schema validation, numeric-grounding guard).
- Coverage targets: `src/lib` + `shared` ≥ 90% lines; overall ≥ 80%.
- Each new UI feature gets at least one RTL test, and a11y-relevant behaviour is asserted (labels, focus, live regions).

## Workflow for each task

1. Open `docs/IMPLEMENTATION_PLAN.md`, pick the next unchecked task in the current phase.
2. Re-read the relevant doc section(s). If the doc and the request disagree, ask.
3. Implement in small steps; run `npm run check`.
4. Tick the checkbox in `IMPLEMENTATION_PLAN.md`.
5. If you changed a prompt or schema, add an entry to `docs/PROMPT_LOG.md`.
6. If you made an architectural choice, add an ADR to `docs/DECISIONS.md`.

## Git conventions

- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`.
- One logical change per commit.
- **Do not add `Co-Authored-By` or any other attribution trailers to commit messages.**
- Never commit `.env`, `.dev.vars`, `coverage/`, `dist/`, `playwright-report/`.

## Things to avoid

- Asking Gemini for AQI, pollutant values, or forecasts.
- Calling Gemini on every render or every data refresh — only on explicit user action or first load per (location, hour, profile) cache key.
- Hard-coded colours outside the design tokens in `docs/UI_UX.md`.
- Fetching from any host not listed in the CSP in `docs/SECURITY.md`.
- Alarmist copy. Tone is calm, practical, specific.
