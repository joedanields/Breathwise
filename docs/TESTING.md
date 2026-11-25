# Testing — Breathwise

## 1. Strategy

| Layer | Tool | What | Target |
|---|---|---|---|
| Unit (pure logic) | Vitest | `src/lib/**`, `shared/**` | ≥ 90% lines/branches |
| Function | Vitest (call `onRequestPost` with a `Request`) | `functions/api/advise.ts` | All checks in `SECURITY.md §3` |
| Component | Vitest + React Testing Library + MSW | Feature components & hooks | Key states: loading, success, error, stale, fallback |
| E2E | Playwright | Critical journeys on built app | 3 browsers (chromium, firefox, webkit) + mobile viewport |
| Accessibility | `@axe-core/playwright` + `axe-core` matcher (`tests/a11y/axe.ts`) | Every screen/state | 0 serious/critical |
| Static | ESLint (jsx-a11y), `tsc --noEmit` | Whole repo | 0 errors |

Overall coverage ≥ 80%. Coverage report uploaded as CI artefact.

## 2. Test data policy

- **Mocks exist only in tests.** MSW handlers and fixtures live in `tests/`; ESLint forbids importing them from runtime code.
- Fixtures are **captured real API responses** (record once with a script `scripts/capture-fixtures.mjs`, store date in filename). Include: a severe-smog north-India day, a moderate coastal day, a response with `null` gaps, and a non-India reverse-geocode result.
- E2E against live APIs is a separate, optional job (`e2e:live`) — default E2E uses Playwright route interception with fixtures so CI is deterministic.

## 3. Required unit tests

### `lib/aqi`
- Breakpoint boundaries for every pollutant; mid-band interpolation; cap at 500
- CO µg/m³ → mg/m³ conversion
- 24 h / 8 h averaging with nulls; insufficient-hours → invalid
- NAQI null when < 3 pollutants or no PM
- Dominant pollutant selection; tie-break deterministic

### `lib/rules`
- `bands`: PM2.5 → category mapping
- `trend`: rising / falling / steady thresholds
- `windows`: respects waking hours, duration, non-overlap, horizon; handles all-equal series; handles nulls
- `ventilation`: returns `[]` when all hours very poor/severe; prefers windy hours
- `memberRisk`: full table in `AQI_AND_RULES.md §6` (table-driven test)

### `lib/impact`
- Weekly kg formula; carpool division; WFH; missing distance → no facts
- Every factor has `source`

### `lib/snapshot`
- Builds complete snapshot from fixtures; rounds coordinates to 2 dp; omits weather gracefully
- Snapshot validates against `FactsSnapshotSchema`

### `shared/advice`
- `requestSchema`: rejects oversized question, extra history, bad mode
- `planSchema`: accepts valid sample; rejects missing `why`, too many actions
- `prompt`: snapshot embedded; language rule present; chat question delimited
- `groundingGuard`: passes grounded text (incl. "2–4 pm", "W1", "45%" when in comparisons); fails on invented "AQI 150"
- `gemini`: parses candidates; handles SAFETY finish, empty candidates, timeout, non-JSON

### `features/advice/fallbackPlan`
- Produces valid `AdvicePlan` for every risk level; no purifier vs purifier; infant mask rule

## 4. Function tests (`tests/unit/functions/advise.test.ts`)

- 405 non-POST · 403 bad origin · 415 wrong content type · 413 oversized · 400 invalid body
- 429 after limit (fake KV)
- 200 happy path (mock `fetch` to Gemini)
- `upstream` on Gemini 500 / timeout; `invalid_output` on schema mismatch
- Never includes the API key or upstream body in responses

## 5. Component tests (selection)

- `LocationSearch`: debounced fetch, keyboard selection, empty state, error state
- Geolocation denied → message + focus to search
- `LiveAqiCard`: shows category text + icon; live region text on update; stale banner
- `FreshnessBar`: relative time; stale styling > 90 min
- `ForecastTimeline`: window badges; table view toggle
- `PlanTabs` + `ActionCard`: renders plan; text only (assert no HTML injection from `<img onerror>` string)
- AI failure → fallback notice + fallback plan
- `ChatPanel`: char limit, submit, `role="log"` updates, out-of-scope message
- `ByokField`: masked; stored in `sessionStorage` not `localStorage`; clear works
- Onboarding: complete flow with keyboard only

## 6. E2E journeys (`tests/e2e`)

1. **Search flow:** open app → search "Lucknow" → select → complete onboarding (child with asthma) → dashboard shows India AQI, provenance, timeline, plan tabs.
2. **Scenario flow:** "Try a sample household" → pick "Senior in Kolkata" → plan visible.
3. **Geolocation flow:** grant mocked geolocation (Pune coordinates) → place name shown.
4. **Outside India:** mocked geolocation in another country → India-only message.
5. **AI down:** `/api/advise` returns 500 → fallback plan + notice.
6. **Chat:** ask question → answer appears; injection attempt → refusal.
7. **Accessibility:** axe scan on onboarding steps, dashboard (each tab), settings, chat open.
8. **Mobile:** journey 1 at 360×740.

## 7. CI (`.github/workflows/ci.yml`)

```
on: [push, pull_request]
jobs:
  check:   npm ci → lint → typecheck → test:cov (upload coverage) → build → bundle-size check
  e2e:     needs check → npx playwright install --with-deps → e2e (upload report on failure)
  security: npm audit --audit-level=high · gitleaks
```

## 8. Manual QA before each submission

Run every scenario in `TEST_SCENARIOS.md` on the deployed URL (desktop + phone), plus the AI evaluation checklist in `AI_DESIGN.md §9`. Lighthouse: Performance ≥ 90, Accessibility 100, Best Practices ≥ 95.
