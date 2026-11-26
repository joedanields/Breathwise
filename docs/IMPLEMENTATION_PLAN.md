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

- [ ] `lib/aqi/breakpoints.ts` (with CPCB reference comment), `averages.ts`, `naqi.ts`, `categories.ts`
- [ ] `lib/rules/bands.ts`, `trend.ts`, `windows.ts`, `ventilation.ts`, `thresholds.ts`, `memberRisk.ts`
- [ ] `lib/impact/emissionFactors.ts` (each with source + URL), `commuteEmissions.ts`
- [ ] Purifier ACH facts helper
- [ ] `lib/snapshot.ts` → `FactsSnapshot` + `shared/types.ts` + Zod `FactsSnapshotSchema`
- [ ] All unit tests in `TESTING.md §3` for these modules; coverage ≥ 90%

**Exit:** `buildFactsSnapshot(fixture…)` produces a valid snapshot; all rule tests green.

## Phase 4 — Profile & onboarding

- [ ] `profileSchema.ts` (Zod, member label ≤ 30 chars), `profileStore` (localStorage), `lib/hash.ts`
- [ ] Onboarding steps 1–3 per `UI_UX.md §3.1`
- [ ] Household sheet (edit), Settings sheet (theme, language, remember location, clear data)
- [ ] `scenarios.ts` with S1–S6 from `TEST_SCENARIOS.md` (profile + location only)
- [ ] "Try a sample household" picker
- [ ] Tests: keyboard-only onboarding, validation errors, clear data, scenario load

**Exit:** user can onboard or load a scenario; profile persists across reloads.

## Phase 5 — Dashboard (live data UI)

- [ ] `LiveAqiCard`, `PollutantGrid`, `FreshnessBar` (stale > 90 min), live region
- [ ] `WeatherStrip` with rules-based context sentence (calm wind / high humidity / rain expected)
- [ ] `ForecastTimeline` + `ForecastTable`, window badges W1/W2/V1
- [ ] About-data sheet (sources, model note, NAQI method, attribution, privacy)
- [ ] Loading skeletons, error cards with retry, insufficient-data state
- [ ] Responsive two-column layout ≥ 1024 px
- [ ] Component tests + axe

**Exit:** dashboard fully usable without AI; provenance visible everywhere.

## Phase 6 — AI layer

- [ ] `shared/config.ts` (DEFAULT_MODEL from env, limits, timeouts)
- [ ] `shared/advice/requestSchema.ts`, `planSchema.ts`, `chatSchema.ts` (+ JSON schemas for Gemini)
- [ ] `shared/advice/prompt.ts` (v1 prompts from `AI_DESIGN.md §6`)
- [ ] `shared/advice/gemini.ts` (REST, header auth, timeout, parsing, error mapping)
- [ ] `shared/advice/groundingGuard.ts` + retry logic
- [ ] `functions/api/advise.ts` with every check in `SECURITY.md §3`
- [ ] `features/advice/transport.ts` (proxy | byok), `useAdvice` (cache key), `fallbackPlan.ts`
- [ ] `PlanTabs`, `ActionCard`, member notes, seek-care callout, regenerate button
- [ ] `ByokField` in Settings (sessionStorage)
- [ ] Tests: `TESTING.md §3 shared/advice`, §4 function tests, fallback UI test
- [ ] Run `AI_DESIGN.md §9` checklist on S1–S6; log in `PROMPT_LOG.md`

**Exit:** plan generated via proxy locally (`wrangler pages dev`) and via BYOK; failures degrade to fallback.

## Phase 7 — Chat & language

- [ ] `useChat`, `ChatPanel` (lazy), history ≤ 6 turns, 500-char limit
- [ ] Out-of-scope + injection handling verified (E6, E7)
- [ ] Response language select (en, hi, bn, ta, mr); `lang` attribute on AI text blocks
- [ ] Tests

**Exit:** chat answers grounded questions for all scenarios.

## Phase 8 — Hardening, performance, a11y

- [ ] Full axe pass on all states; manual keyboard + screen reader (NVDA or VoiceOver) pass
- [ ] Contrast verification of all tokens; update `UI_UX.md`
- [ ] Bundle check (< 200 KB gzip initial); lazy-load chat and sheets
- [ ] Lighthouse targets from `TESTING.md §8`
- [ ] E2E journeys 1–8 green in CI
- [ ] `npm audit` clean (high+), gitleaks clean
- [ ] README screenshots

**Exit:** CI fully green; Lighthouse targets met locally.

## Phase 9 — Deploy & submit

- [ ] Cloudflare Pages project + secrets + KV per `DEPLOYMENT.md`
- [ ] Set `ALLOWED_ORIGINS` to production + preview domains
- [ ] Smoke test all scenarios + edge cases on production
- [ ] Record demo video (`SUBMISSION.md §2`)
- [ ] Write LinkedIn post (`SUBMISSION.md §3`)
- [ ] Final pre-submission checklist (`SUBMISSION.md §1`)

**Exit:** submission complete.
