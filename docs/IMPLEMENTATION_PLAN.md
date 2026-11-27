# Implementation Plan — Breathwise

Work top to bottom. Tick boxes as you go. Each phase ends with `npm run check` green and a commit. Don't start a phase until the previous one's exit criteria are met.

---

## Phase 1 — Scaffold & tooling

- [x] `npm create vite@latest . -- --template react-ts` (keep existing `docs/`, `README.md`, `CLAUDE.md`)
- [x] TS strict + `noUncheckedIndexedAccess`; path aliases `@/` → `src/`, `@shared/` → `shared/`
- [x] Tailwind v4 via `@tailwindcss/vite`; design tokens from `UI_UX.md §2`
- [x] ESLint (typescript-eslint, react-hooks, jsx-a11y) + Prettier; `no-restricted-imports` rule blocking `tests/**` from runtime dirs
- [x] Vitest + RTL + jsdom + MSW + axe-core matcher (replaces `vitest-axe`, ADR-009); coverage via v8
- [x] Playwright + `@axe-core/playwright`
- [x] Scripts from `CLAUDE.md` (`dev`, `dev:api`, `build`, `lint`, `typecheck`, `test`, `test:cov`, `e2e`, `check`)
- [x] `.gitignore` (node_modules, dist, coverage, playwright-report, test-results, .env*, !.env.example, .dev.vars, .wrangler)
- [x] `.env.example`, `.dev.vars.example` (names only)
- [x] `.nvmrc` (22)
- [x] `wrangler.toml` with `pages_build_output_dir = "dist"`, `compatibility_date`, KV binding `RATE_LIMIT_KV`, `[vars] GEMINI_MODEL`, `ALLOWED_ORIGINS`
- [x] Vite `server.proxy` `/api` → `http://localhost:8788`
- [x] `public/_headers` from `SECURITY.md §4`
- [x] `.github/workflows/ci.yml` from `TESTING.md §7`; Dependabot config
- [x] App shell: `Header`, `Footer` (attribution), `SkipLink`, `ErrorBoundary`, theme

**Exit:** blank app builds, lints, tests (1 smoke test) and passes axe on shell; CI green.

## Phase 2 — Location & data layer

- [x] `lib/storage.ts` safe wrappers (try/catch, Zod parse)
- [x] `features/location`: `useCurrentPosition` (timeout 10 s, `maximumAge` 10 min), `reverseGeocode` (BigDataCloud), `searchPlaces` (Open-Meteo, `countryCode=IN`), `LocationSearch` combobox, India-only check
- [x] `features/airquality/api.ts` + `schemas.ts` (Zod for response in `DATA_SOURCES.md §1`)
- [x] `features/weather/api.ts` + `schemas.ts`
- [x] `useAirQuality`, `useWeather` (TanStack Query, `staleTime` 15 min, refetch on visibility, interval 15 min)
- [x] `scripts/capture-fixtures.mjs` → `tests/fixtures/*.json` (real responses for Delhi, Chennai, a null-gap case, non-India reverse geocode)
- [x] MSW handlers using fixtures (tests only)
- [x] Tests: schema parsing, null handling, search debounce, geolocation denied

**Exit:** dev page shows raw parsed current values + reading time for a searched Indian city.

✅ Done 2026-11-26: `features/preview/DataPreview` (temporary, replaced by the Phase 5 dashboard) shows parsed current values, reading time in the location's time zone, "fetched N min ago", the source, the modelled-estimate note and "nearest model grid point ~45 km"; stale is judged by reading time (> 90 min). Checked live for Lucknow, Guwahati and Kochi. India-only fallback: ADR-010.

## Phase 3 — AQI & rules engine (tests first)

- [x] `lib/aqi/breakpoints.ts` (with CPCB reference comment), `averages.ts`, `naqi.ts`, `categories.ts`
- [x] `lib/rules/bands.ts`, `trend.ts`, `windows.ts`, `ventilation.ts`, `thresholds.ts`, `memberRisk.ts`
- [x] `lib/impact/emissionFactors.ts` (each with source + URL), `commuteEmissions.ts`
- [x] Purifier ACH facts helper
- [x] `lib/snapshot.ts` → `FactsSnapshot` + `shared/types.ts` + Zod `FactsSnapshotSchema`
- [x] All unit tests in `TESTING.md §3` for these modules; coverage ≥ 90%

**Exit:** `buildFactsSnapshot(fixture…)` produces a valid snapshot; all rule tests green.

✅ Done 2026-11-27: snapshots from the Delhi and Chennai captures and both derived fixtures validate against `FactsSnapshotSchema`. Sources and conventions: `AQI_AND_RULES.md §0`, ADR-011. Impact facts are signed and exposure benefits separate (prompt v1.1).

## Phase 4 — Profile & onboarding

- [x] `profileSchema.ts` (Zod, member label ≤ 30 chars), `profileStore` (localStorage), `lib/hash.ts`
- [x] Onboarding steps 1–3 per `UI_UX.md §3.1`
- [x] Household sheet (edit), Settings sheet (theme, language, remember location, clear data)
- [x] `scenarios.ts` with S1–S6 from `TEST_SCENARIOS.md` (profile + location only)
- [x] "Try a sample household" picker
- [x] Tests: keyboard-only onboarding, validation errors, clear data, scenario load

**Exit:** user can onboard or load a scenario; profile persists across reloads.

✅ Done 2026-11-28: onboarding, Household and Settings sheets, S1–S6 picker (checked against TEST_SCENARIOS.md by a test), clear data with confirmation, corrupt-storage reset. E2E: keyboard-only onboarding, axe on every step and sheet in light and dark, CSP violation check (ADR-012).

## Phase 5 — Dashboard (live data UI)

- [x] `LiveAqiCard`, `PollutantGrid`, `FreshnessBar` (stale > 90 min), live region
- [x] `WeatherStrip` with rules-based context sentence (calm wind / high humidity / rain expected)
- [x] `ForecastTimeline` + `ForecastTable`, window badges W1/W2/V1
- [x] About-data sheet (sources, model note, NAQI method, attribution, privacy)
- [x] Loading skeletons, error cards with retry, insufficient-data state
- [x] Responsive two-column layout ≥ 1024 px
- [x] Component tests + axe

**Exit:** dashboard fully usable without AI; provenance visible everywhere.

✅ Done 2026-11-28: India AQI card (category text + icon, live region), pollutant grid with sub-indices, FreshnessBar (reading-time staleness), rules-based WeatherStrip, 48 h timeline + table view with W/V/X badges, About data sheet, rules-only "Today for your household" card, loading/error/insufficient states, two columns ≥ 1024 px. E2E axe on the dashboard and table view in light and dark; no horizontal scroll at 360 px.

## Phase 6 — AI layer

- [x] `shared/config.ts` (DEFAULT_MODEL from env, limits, timeouts)
- [x] `shared/advice/requestSchema.ts`, `planSchema.ts`, `chatSchema.ts` (+ JSON schemas for Gemini)
- [x] `shared/advice/prompt.ts` (v1 prompts from `AI_DESIGN.md §6`)
- [x] `shared/advice/gemini.ts` (REST, header auth, timeout, parsing, error mapping)
- [x] `shared/advice/groundingGuard.ts` + retry logic
- [x] `functions/api/advise.ts` with every check in `SECURITY.md §3`
- [x] `features/advice/transport.ts` (proxy | byok), `useAdvice` (cache key), `fallbackPlan.ts`
- [x] `PlanTabs`, `ActionCard`, member notes, seek-care callout, regenerate button
- [x] `ByokField` in Settings (sessionStorage)
- [x] Tests: `TESTING.md §3 shared/advice`, §4 function tests, fallback UI test
- [x] Run `AI_DESIGN.md §9` checklist on S1–S6; log in `PROMPT_LOG.md`

**Exit:** plan generated via proxy locally (`wrangler pages dev`) and via BYOK; failures degrade to fallback.

✅ Done 2026-11-28: proxy plans for S1–S6 + Hindi via `wrangler pages dev` with real Gemini, grounded first try 7/7 (PROMPT_LOG v1.1 → v1.3). BYOK uses the same engine in the browser (MSW-tested; a live BYOK run needs the owner's own key). Model `gemini-3.5-flash-lite` (ADR-013). Failures fall back to the rules-based plan with a notice (unit, component and e2e tests).

## Phase 7 — Chat & language

- [x] `useChat`, `ChatPanel` (lazy), history ≤ 6 turns, 500-char limit
- [x] Out-of-scope + injection handling verified (E6, E7)
- [x] Response language select (en, hi, bn, ta, mr); `lang` attribute on AI text blocks
- [x] Tests

**Exit:** chat answers grounded questions for all scenarios.

✅ Done 2026-11-28: lazy ChatPanel (role="log", 500-char counter, ≤ 6 turns sent), grounded and guarded like the plan. Live check: E6 refusal, E7 no invented numbers, S1–S6 sample questions grounded first try 8/8 (PROMPT_LOG chat v1.1). Response language (en, hi, bn, ta, mr) in onboarding and Settings; AI text blocks carry `lang`.

## Phase 8 — Hardening, performance, a11y

- [x] Full axe pass on all states (e2e, light + dark, 4 projects); keyboard-only e2e — **screen reader (NVDA/VoiceOver) pass: manual, for the owner**
- [x] Contrast verification of all tokens; update `UI_UX.md`
- [x] Bundle check (< 200 KB gzip initial: 165 KB); chat lazy-loaded (sheets kept in the main chunk: budget met)
- [ ] Lighthouse targets from `TESTING.md §8` — **manual, for the owner** (automated run was blocked by the agent sandbox)
- [x] E2E journeys 1–8 green in CI
- [x] `npm audit` clean (high+), gitleaks clean
- [x] README screenshots

**Exit:** CI fully green; Lighthouse targets met locally.

## Phase 9 — Deploy & submit

- [x] Cloudflare Pages project + secrets + KV per `DEPLOYMENT.md`
- [x] Set `ALLOWED_ORIGINS` to production + preview domains
- [x] Smoke test all scenarios + edge cases on production (S1–S6, E1, E4, E6; `docs/PROGRESS.md`)
- [ ] Record demo video (`SUBMISSION.md §2`, script ready) — **owner**
- [x] Write LinkedIn post (`SUBMISSION.md §3`, draft ready to post — **owner posts**)
- [ ] Final pre-submission checklist (`SUBMISSION.md §1`) — all automated items done; owner: video, LinkedIn, Lighthouse

**Exit:** submission complete.
