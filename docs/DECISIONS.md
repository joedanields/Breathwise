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
