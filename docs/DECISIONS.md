# Architecture Decision Records — Breathwise

Format: Context → Decision → Consequences. Add new ADRs at the bottom; never rewrite accepted ones (supersede instead).

---

## ADR-001 Vite React SPA instead of Next.js
**Status:** Accepted · 2026-11-25
**Context:** The project must be frontend-only and hosted on Cloudflare Pages. Next.js on Pages needs an adapter, and its server features (SSR, RSC) would go unused.
**Decision:** Vite + React + TypeScript static SPA.
**Consequences:** Simpler build, faster dev loop, smaller config surface. No SSR, which is fine for a personalised client-side tool.

## ADR-002 Gemini via a Pages Function proxy, with bring-your-own-key as fallback
**Status:** Accepted · 2026-11-25
**Context:** A Gemini key in browser code can be extracted by anyone. Google's ephemeral tokens currently only support the Live API. Evaluators should be able to use the app without their own key.
**Decision:** `functions/api/advise.ts` holds the key as a Cloudflare secret and accepts only structured, validated input; prompts are built server-side. Optional BYOK mode calls Gemini directly with a key kept in `sessionStorage`.
**Consequences:** One small serverless function (no server to manage). Needs origin checks and rate limiting. BYOK keeps the app usable if the server quota runs out.

## ADR-003 Compute India AQI in code from Open-Meteo (CAMS) concentrations
**Status:** Accepted · 2026-11-25
**Context:** The challenge requires live, reliable, free, CORS-friendly data. Open-Meteo provides pollutant concentrations, US AQI and European AQI, but not India's NAQI. CPCB station APIs are not reliably CORS-friendly or keyless.
**Decision:** Fetch concentrations from Open-Meteo and compute NAQI with CPCB breakpoints in a pure, tested module. Label it "estimated" and show US AQI as a reference.
**Consequences:** Familiar Indian scale for users. Must be transparent that values are modelled (~45 km grid), not station readings.

## ADR-004 Code computes, AI interprets
**Status:** Accepted · 2026-11-25
**Context:** The rules forbid LLM-generated AQI. LLMs can also make up numbers.
**Decision:** All numbers come from APIs or deterministic functions and are packed into a `FactsSnapshot`. The AI output schema has no numeric data fields. A grounding guard rejects ungrounded numbers in the text. A rules-based fallback plan exists.
**Consequences:** Higher trust and testability. Slightly more upfront logic. The app still works without AI.

## ADR-005 BigDataCloud for reverse geocoding
**Status:** Accepted · 2026-11-25
**Context:** Open-Meteo Geocoding has forward search only. We need GPS → place name without a key.
**Decision:** Use BigDataCloud's free client-side reverse geocoding endpoint, only after the user grants location.
**Consequences:** Must comply with its client-side-only fair-use policy. Fall back to coordinates on failure.

## ADR-006 Household profile stored only on the device
**Status:** Accepted · 2026-11-25
**Context:** Health conditions are sensitive. There is no backend database.
**Decision:** `localStorage` with Zod validation and a "Clear my data" option. The profile is sent only inside AI requests, with coordinates rounded.
**Consequences:** No cross-device sync (acceptable for v1). Strong privacy story.

## ADR-007 Gemini via REST instead of the SDK
**Status:** Accepted · 2026-11-25
**Context:** The same call must run in the browser (BYOK) and in a Cloudflare Worker runtime. Bundle size matters.
**Decision:** A thin `fetch`-based client in `shared/advice/gemini.ts`.
**Consequences:** We maintain the request/response types ourselves. No SDK runtime quirks and a smaller bundle.

## ADR-008 No chart library
**Status:** Accepted · 2026-11-25
**Context:** The only chart is a 48-hour band timeline.
**Decision:** A CSS grid of hour cells plus an accessible table alternative.
**Consequences:** Smaller bundle and full control over accessibility.

## ADR-009 Toolchain versions and AQI contrast fix
**Status:** Accepted · 2026-11-25
**Context:** Phase 1 uses the latest stable dependencies, but several of the newest majors conflict. typescript-eslint 8.74 supports TypeScript < 6.1 (TypeScript 7.0 is out). eslint-plugin-jsx-a11y 6.10 supports ESLint ≤ 9 (ESLint 10 is out). jsdom 31 needs Node ≥ 22.22.2. vitest-axe has had only one release (0.1.0) in years. Separately, two AQI category colours in `UI_UX.md` failed WCAG 4.5:1 with white text: Good `#2E9E4F` (3.43:1) and Very Poor `#E03C31` (4.32:1).
**Decision:**
1. Pin TypeScript to the latest 6.0.x (`~6.0.3`).
2. Use the latest ESLint 9.x (`^9.39.5`) with `@eslint/js` 9.x.
3. Use jsdom 31 and require Node ≥ 22.22.2 (`"engines"` in `package.json`; `.nvmrc` stays `22`).
4. Use `axe-core` directly with a small `toHaveNoViolations` matcher in `tests/a11y/axe.ts` instead of vitest-axe.
5. Darken Good to `#237A3C` (5.36:1) and Very Poor to `#C0302A` (5.68:1), both with white text. All token pairs are verified and recorded in `UI_UX.md §2`.

Dependabot ignores the held-back majors (TypeScript ≥ 6.1, ESLint ≥ 10, `@types/node` ≥ 23).
**Consequences:** Lint, typecheck and tests run on a supported, compatible set. Revisit when typescript-eslint supports TypeScript 7 and jsx-a11y supports ESLint 10, and then lift the Dependabot ignores. One less unmaintained dependency. The AQI colours meet AA for label text. Swatches still rely on their text label and icon, never colour alone.

## ADR-010 India check when reverse geocoding fails
**Status:** Accepted · 2026-11-26
**Context:** Breathwise is India-only. After GPS succeeds, BigDataCloud's `countryCode` tells us whether the user is in India. If that call fails (network, fair-use limit, or an empty `countryCode`), we cannot confirm the country. `ARCHITECTURE.md §6` said to show "Near 28.61, 77.21" and continue, which would let a location outside India through.
**Decision:** Fall back to a coarse India bounding box: latitude 6–37.5, longitude 68–97.5. Inside it, continue with the label "Near 28.61, 77.21 (place name unavailable)" and keep the search box visible so the user can pick a named place. Outside it, show the India-only message. A successful reverse geocode always wins over the box.
**Consequences:** No extra dependency or data file. The box also covers parts of Pakistan, Nepal, Bhutan, Bangladesh, Myanmar and Sri Lanka, so it is a sanity check, not proof of location; the "place name unavailable" label and the visible search box make that clear. Open-Meteo still returns valid data anywhere, so nothing breaks if a border-area user slips through.

## ADR-011 NAQI conventions and emission-factor sources
**Status:** Accepted · 2026-11-27
**Context:** Phase 3 checked every NAQI value against CPCB's 2014 report (Table 3.11) and every emission factor against India-specific sources. CPCB leaves some rules open: the Severe band has no upper bound, and there is no rule for 8-hour data sufficiency. The India GHG road factors don't cover metro, and the profile doesn't record car size or AC.
**Decision:**
1. Breakpoints exactly as R Table 3.11, with continuous bands. Severe upper bounds from the CPCB-hosted calculator reproduction (PM10 510, PM2.5 380, NO₂ 520, O₃ 1000, CO 50, SO₂ 2620), labelled as a convention; above them the index caps at 500.
2. Apply the Table 3.11 O₃ footnote: above 208 µg/m³ (8-hour), use the 1-hour value.
3. O₃ and CO use the latest 8-hour mean with ≥ 6 of 8 valid hours (convention).
4. Road factors from the India GHG Program (2015, v1.0): petrol and diesel hatchback <1400 cc, CNG small <800 cc (the only CNG row; it overstates CNG savings vs petrol), scooter <110 cc, CNG auto, intra-city bus per passenger-km.
5. Metro = UNEP-DTU energy intensity (back-calculated, 0.061 ÷ 0.943 kWh/pkm) × CEA v22.0 FY 2025-26 grid factor (0.675 tCO₂/MWh) ≈ 0.0437 kg/pkm, with the system-boundary caveat (power generation vs tailpipe) stated in every metro fact.
6. Impact facts carry a signed weekly delta, and exposure benefits are separate facts (metro and WFH only; bus stays above ambient in Goel et al. 2015).
**Consequences:** Every number in `AQI_AND_RULES.md` has a "Source status": verified (R/H), CPCB-adjacent (X), or Breathwise convention. Category results never depend on the conventions; only exact values within 401–500 and per-km CO₂ do. Revisit when CPCB revises the AQI method (it is under review) or the India GHG Program publishes a final road paper.
